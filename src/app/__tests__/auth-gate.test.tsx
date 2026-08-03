import type { Session } from '@supabase/supabase-js';
import { act, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import IndexRedirect from '@/app/index';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({
    isLoadingOrganizations: false,
    isOrganizationSetupOpen: false,
  }),
}));

jest.mock('@/components/bottom-tab-bar', () => ({
  BottomTabBar: () => null,
}));

const mockPathname: { current: string } = { current: '/' };
const mockRedirectHrefs: unknown[] = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockTabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  MockTabs.Screen = () => null;

  return {
    Redirect: ({ href }: { href: unknown }) => {
      mockRedirectHrefs.push(href);
      return React.createElement(
        Text,
        { testID: 'redirect' },
        JSON.stringify(href),
      );
    },
    Tabs: MockTabs,
    usePathname: () => mockPathname.current,
  };
});

const authMock = supabase.auth as unknown as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
};

const fakeSession = { user: { id: 'user-1' } } as Session;

function mountAuth(
  resolveWith: Promise<{ data: { session: Session | null } }>,
) {
  authMock.getSession.mockReturnValue(resolveWith);
  authMock.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
}

function deferredSession() {
  let resolveSession!: (value: { data: { session: Session | null } }) => void;
  const promise = new Promise<{ data: { session: Session | null } }>(
    (resolve) => {
      resolveSession = resolve;
    },
  );
  return { promise, resolveSession };
}

describe('auth gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirectHrefs.length = 0;
    mockPathname.current = '/';
  });

  describe('index redirect', () => {
    it('renders nothing while the session loads (no login flash)', async () => {
      const { promise } = deferredSession();
      mountAuth(promise);

      const { queryByTestId } = render(<IndexRedirect />);

      expect(queryByTestId('redirect')).toBeNull();
    });

    it.each([
      ['signed-in', fakeSession, '/(tabs)/home'],
      ['signed-out', null, '/login'],
    ])('redirects a %s cold start to %s', async (_label, session, expected) => {
      mountAuth(Promise.resolve({ data: { session } }));

      render(<IndexRedirect />);

      await waitFor(() => {
        expect(mockRedirectHrefs).toEqual([expected]);
      });
    });
  });

  describe('tabs gate', () => {
    it('redirects an unauthenticated deep link to login with the sanitized redirect', async () => {
      mockPathname.current = '/control';
      mountAuth(Promise.resolve({ data: { session: null } }));

      render(<TabsLayout />);

      await waitFor(() => {
        expect(mockRedirectHrefs).toEqual([
          { pathname: '/login', params: { redirect: '/control' } },
        ]);
      });
    });

    it('redirects any unauthenticated tab route, not just control', async () => {
      mockPathname.current = '/team';
      mountAuth(Promise.resolve({ data: { session: null } }));

      render(<TabsLayout />);

      await waitFor(() => {
        expect(mockRedirectHrefs).toEqual([
          { pathname: '/login', params: { redirect: '/team' } },
        ]);
      });
    });

    it('renders the tab navigator for signed-in users', async () => {
      mountAuth(Promise.resolve({ data: { session: fakeSession } }));

      const { queryByTestId } = render(<TabsLayout />);

      await waitFor(() => {
        expect(queryByTestId('redirect')).toBeNull();
      });
    });

    it('keeps tabs mounted on web while initializing and redirects with the real path', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        get: () => 'web',
      });
      const originalWindow = globalThis.window;
      globalThis.window = {
        location: { pathname: '/team' },
      } as unknown as typeof globalThis.window;

      try {
        const { promise, resolveSession } = deferredSession();
        mountAuth(promise);

        const { queryByTestId } = render(<TabsLayout />);

        expect(queryByTestId('redirect')).toBeNull();

        await act(async () => {
          resolveSession({ data: { session: null } });
        });

        expect(mockRedirectHrefs).toEqual([
          { pathname: '/login', params: { redirect: '/team' } },
        ]);
      } finally {
        Object.defineProperty(Platform, 'OS', {
          configurable: true,
          value: originalOS,
        });
        globalThis.window = originalWindow;
      }
    });
  });
});
