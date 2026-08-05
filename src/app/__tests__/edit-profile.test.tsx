import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import EditProfileScreen from '@/app/edit-profile';
import { supabase } from '@/lib/supabase';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/components/phone-country-dropdown', () => ({
  PhoneCountryDropdown: () => null,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;

const profileUser = {
  id: 'user-1',
  email: 'ana@empresa.com',
  phone: '+56912345678',
  user_metadata: {
    display_name: 'Ana Pérez',
    position: 'Diseñadora',
    address: 'Av Siempre Viva 123',
  },
};

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: profileUser }, error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('loads and renders the saved profile fields', async () => {
    render(<EditProfileScreen />);

    expect(await screen.findByDisplayValue('Ana Pérez')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Av Siempre Viva 123')).toBeOnTheScreen();
    expect(screen.getByText('ana@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Guardar cambios')).toBeOnTheScreen();
  });

  it('saves changes and shows the success message', async () => {
    render(<EditProfileScreen />);

    await screen.findByDisplayValue('Ana Pérez');
    fireEvent.changeText(
      screen.getByPlaceholderText('Nombre y apellido'),
      'Ana María Pérez',
    );
    fireEvent.press(screen.getByText('Guardar cambios'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: {
          display_name: 'Ana María Pérez',
          address: 'Av Siempre Viva 123',
          position: 'Diseñadora',
          phone: '+56912345678',
        },
      });
    });

    expect(
      await screen.findByText('Perfil actualizado correctamente.'),
    ).toBeOnTheScreen();
  });

  it('rejects an invalid profile without calling the API', async () => {
    render(<EditProfileScreen />);

    await screen.findByDisplayValue('Ana Pérez');
    fireEvent.changeText(
      screen.getByPlaceholderText('Nombre y apellido'),
      'An',
    );
    fireEvent.press(screen.getByText('Guardar cambios'));

    expect(
      await screen.findByText('Revisá los campos marcados y corregilos.'),
    ).toBeOnTheScreen();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
