import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import LoginScreen from '@/app/(auth)/login';
import { supabase } from '@/lib/supabase';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');

  return {
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
  };
});

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the login form with brand and helper copy', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Bienvenido a Minuto')).toBeOnTheScreen();
    expect(screen.getByText('Ingresa a tu cuenta')).toBeOnTheScreen();
    expect(screen.getByText('Iniciar Sesión →')).toBeOnTheScreen();
    expect(screen.getByText(/Registrate en Minuto/)).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('nombre@empresa.com')).toBeOnTheScreen();
  });

  it('submits valid credentials and redirects to the tabs home', async () => {
    mockSignIn.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });

    render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('nombre@empresa.com'),
      'ana@empresa.com',
    );
    fireEvent.changeText(screen.getByPlaceholderText('********'), 'secret123');
    fireEvent.press(screen.getByText('Iniciar Sesión →'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    });
  });

  it('toggles the password visibility label', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Ver'));
    expect(screen.getByText('Ocultar')).toBeOnTheScreen();
  });
});
