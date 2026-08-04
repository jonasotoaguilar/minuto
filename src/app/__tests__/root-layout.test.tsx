import type { Session } from '@supabase/supabase-js';
import { act, render, waitFor } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '@/app/_layout';
import { supabase } from '@/lib/supabase';

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

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
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

  return { Stack: MockStack, usePathname: () => '/' };
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

describe('root layout session gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('holds the splash (renders nothing) until the session is known', async () => {
    authMock.getSession.mockReturnValue(new Promise(() => undefined));
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });

    const { queryByTestId } = render(<RootLayout />);

    expect(queryByTestId('protected')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('renders the stack with open protected guards once a session is known', async () => {
    mountAuth(Promise.resolve({ data: { session: fakeSession } }));

    const { getByTestId } = render(<RootLayout />);

    await waitFor(() => {
      expect(getByTestId('protected')).toHaveTextContent('true');
    });

    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('protects signed-out users from protected screens', async () => {
    mountAuth(Promise.resolve({ data: { session: null } }));

    const { getByTestId } = render(<RootLayout />);

    await waitFor(() => {
      expect(getByTestId('protected')).toHaveTextContent('false');
    });

    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });
});
