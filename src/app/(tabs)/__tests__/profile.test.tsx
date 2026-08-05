import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import ProfileTabScreen from '@/app/(tabs)/profile';
import { supabase } from '@/lib/supabase';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    setParams: mockSetParams,
  }),
}));

const mockOrgState = {
  activeOrganization: {
    id: 'org-1',
    membershipId: 'membership-1',
    membershipRole: 'owner',
    name: 'Acme',
    defaultTimezone: 'America/Santiago',
    plan: 'free',
    ownerUserId: 'user-1',
  },
  isLoadingOrganizations: false,
  isOrganizationSetupOpen: false,
};

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => mockOrgState,
}));

jest.mock('@/components/header-user-menu', () => ({
  AppHeader: () => null,
}));

jest.mock('@/components/organization-setup-view', () => ({
  OrganizationSetupView: () => null,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;

const signedInUser = {
  id: 'user-1',
  email: 'ana@empresa.com',
  user_metadata: { display_name: 'Ana Pérez' },
};

describe('ProfileTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: signedInUser },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('renders the profile from the authenticated user', async () => {
    render(<ProfileTabScreen />);

    expect(await screen.findByText('Ana Pérez')).toBeOnTheScreen();
    expect(screen.getByText('ana@empresa.com')).toBeOnTheScreen();
    expect(screen.getByText('Perfil')).toBeOnTheScreen();
    expect(screen.getByText('Modificar perfil')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Modificar perfil'));
    expect(mockPush).toHaveBeenCalledWith('/edit-profile');
  });

  it('signs out and redirects to the login screen', async () => {
    render(<ProfileTabScreen />);

    await screen.findByText('Ana Pérez');
    fireEvent.press(screen.getByText('Cerrar sesión'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('shows an error when the profile cannot be loaded', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    render(<ProfileTabScreen />);

    expect(
      await screen.findByText('No se pudo cargar el usuario autenticado.'),
    ).toBeOnTheScreen();
  });
});
