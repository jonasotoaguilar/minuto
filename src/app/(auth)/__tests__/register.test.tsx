import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import RegisterScreen from '@/app/(auth)/register';
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

jest.mock('@/components/phone-country-dropdown', () => ({
  PhoneCountryDropdown: () => null,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const mockSignUp = supabase.auth.signUp as jest.Mock;

function fillForm() {
  fireEvent.changeText(
    screen.getByPlaceholderText('Nombre y apellido'),
    'Ana Pérez',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Av. Siempre Viva 123'),
    'Av Siempre Viva 123',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('nombre@empresa.com'),
    'ana@empresa.com',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('0 0000 0000'),
    '9 1234 5678',
  );
  fireEvent.changeText(
    screen.getAllByPlaceholderText('********')[0],
    'secret123',
  );
  fireEvent.changeText(
    screen.getAllByPlaceholderText('********')[1],
    'secret123',
  );
}

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the registration form with all fields', () => {
    render(<RegisterScreen />);

    expect(screen.getByText('Crea tu cuenta')).toBeOnTheScreen();
    expect(screen.getByText('Registra tu acceso a Minuto')).toBeOnTheScreen();
    expect(screen.getByText('Crear cuenta →')).toBeOnTheScreen();
    expect(screen.getByText(/Inicia sesión/)).toBeOnTheScreen();
    expect(screen.getByText('Nombre completo')).toBeOnTheScreen();
    expect(screen.getByText('Dirección')).toBeOnTheScreen();
    expect(screen.getByText('Teléfono')).toBeOnTheScreen();
    expect(screen.getByText('Confirmar contraseña')).toBeOnTheScreen();
  });

  it('submits a complete valid form and shows the success message', async () => {
    mockSignUp.mockResolvedValue({ error: null });

    render(<RegisterScreen />);
    fillForm();
    fireEvent.press(screen.getByText('Crear cuenta →'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ana@empresa.com',
          options: { data: expect.any(Object) },
        }),
      );
    });

    expect(await screen.findByText(/Registro exitoso/)).toBeOnTheScreen();
  });
});
