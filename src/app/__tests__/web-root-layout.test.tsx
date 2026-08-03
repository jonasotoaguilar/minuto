import type { Session } from '@supabase/supabase-js';
import { render, waitFor } from '@testing-library/react-native';

import WebRootLayout from '@/app/_layout.web';
import { supabase } from '@/lib/supabase';

jest.mock('../../global.css', () => ({}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

jest.mock('@/components/animated-icon', () => ({
  AnimatedSplashOverlay: () => null,
}));

jest.mock('@/hooks/use-organization', () => ({
  OrganizationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('@/theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockStack = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  MockStack.Screen = () => null;
  MockStack.Protected = ({ guard }: { guard: boolean }) =>
    React.createElement(Text, { testID: 'protected' }, JSON.stringify(guard));

  return { Stack: MockStack };
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

describe('web root layout session gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mounts the stack with open guards while the session loads (no null frame)', async () => {
    authMock.getSession.mockReturnValue(new Promise(() => undefined));
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });

    const { getByTestId } = render(<WebRootLayout />);

    // The tree must render (a null frame breaks web URL matching) and the
    // guards stay open so signed-in deep links are preserved.
    expect(getByTestId('protected')).toHaveTextContent('true');
  });

  it('keeps guards open once a signed-in session resolves', async () => {
    mountAuth(Promise.resolve({ data: { session: fakeSession } }));

    const { getByTestId } = render(<WebRootLayout />);

    await waitFor(() => {
      expect(getByTestId('protected')).toHaveTextContent('true');
    });
  });

  it('locks the guards when the session resolves signed-out', async () => {
    mountAuth(Promise.resolve({ data: { session: null } }));

    const { getByTestId } = render(<WebRootLayout />);

    await waitFor(() => {
      expect(getByTestId('protected')).toHaveTextContent('false');
    });
  });
});
