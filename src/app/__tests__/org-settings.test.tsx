import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import OrganizationSettingsScreen from '@/app/org-settings';
import { supabase } from '@/lib/supabase';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockRefreshOrganizations = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

const mockOrgState: {
  activeOrganization: {
    id: string;
    membershipId: string;
    membershipRole: string;
    name: string;
    defaultTimezone: string;
    plan: string;
    ownerUserId: string;
  } | null;
  isLoadingOrganizations: boolean;
  isOrganizationSetupOpen: boolean;
} = {
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
  useOrganization: () => ({
    ...mockOrgState,
    refreshOrganizations: mockRefreshOrganizations,
  }),
}));

jest.mock('@/hooks/use-organization-offices', () => ({
  useOrganizationOffices: () => ({
    errorMessage: '',
    isLoadingOffices: false,
    offices: [
      {
        id: 'office-1',
        addressLabel: 'Torre Norte',
        isRemote: false,
        latitude: -33.4,
        longitude: -70.6,
        name: 'Oficina Central',
        organizationId: 'org-1',
      },
    ],
    reloadOffices: jest.fn(),
  }),
}));

jest.mock('@/components/timezone-picker', () => ({
  TimezonePicker: () => null,
}));

jest.mock('@/components/office-location-search', () => ({
  OfficeLocationSearch: () => null,
}));

jest.mock('@/components/organization-setup-view', () => ({
  OrganizationSetupView: () => null,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const mockRpc = supabase.rpc as jest.Mock;

function setRole(role: string) {
  mockOrgState.activeOrganization = {
    ...mockOrgState.activeOrganization!,
    membershipRole: role,
  };
}

describe('OrganizationSettingsScreen role gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setRole('owner');
    mockRefreshOrganizations.mockResolvedValue(undefined);
    mockRpc.mockResolvedValue({ error: null });
  });

  it.each([
    {
      role: 'owner',
      visible: ['Ajustes de organización', 'Oficinas físicas'],
      hidden: ['No tenés permisos para esta sección.'],
    },
    {
      role: 'admin',
      visible: ['Ajustes de organización', 'Oficinas físicas'],
      hidden: ['No tenés permisos para esta sección.'],
    },
    {
      role: 'manager',
      visible: ['Oficinas físicas'],
      hidden: [
        'Ajustes de organización',
        'No tenés permisos para esta sección.',
      ],
    },
    {
      role: 'employee',
      visible: [],
      hidden: ['Ajustes de organización', 'Oficinas físicas'],
    },
  ])('gates sections for the $role role', ({ role, visible, hidden }) => {
    setRole(role);

    render(<OrganizationSettingsScreen />);

    if (visible.length > 0) {
      expect(screen.getByText('Modificar organización')).toBeOnTheScreen();
    }

    for (const section of visible) {
      expect(screen.getByText(section)).toBeOnTheScreen();
    }

    for (const section of hidden) {
      expect(screen.queryByText(section)).toBeNull();
    }
  });

  it('shows the reserved screen for employees without office access', () => {
    setRole('employee');

    render(<OrganizationSettingsScreen />);

    expect(
      screen.getByText('Solo owners y admins pueden editar la organización.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('No tenés permisos para esta sección.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Volver al equipo')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Volver al equipo'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/team');
  });

  it('saves organization settings and refreshes the organization', async () => {
    render(<OrganizationSettingsScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Nombre de la organización'),
      'Acme S.A.',
    );
    fireEvent.press(screen.getByText('Guardar cambios'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('update_organization_settings', {
        p_default_timezone: 'America/Santiago',
        p_name: 'Acme S.A.',
        p_organization_id: 'org-1',
      });
    });

    expect(mockRefreshOrganizations).toHaveBeenCalled();
    expect(
      await screen.findByText('Organización actualizada.'),
    ).toBeOnTheScreen();
  });

  it('shows the loading state while organizations resolve', () => {
    mockOrgState.isLoadingOrganizations = true;

    render(<OrganizationSettingsScreen />);

    expect(screen.getByText('Cargando organización...')).toBeOnTheScreen();

    mockOrgState.isLoadingOrganizations = false;
  });
});
