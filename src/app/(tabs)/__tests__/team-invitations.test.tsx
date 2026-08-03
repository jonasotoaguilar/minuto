import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import TeamScreen from '@/app/(tabs)/team';

const mockPush = jest.fn();
const mockOrganizationState = {
  activeOrganization: {
    id: 'org-1',
    membershipRole: 'owner',
    name: 'Acme',
  },
  isLoadingOrganizations: false,
  isOrganizationSetupOpen: false,
};

const teamMembersResponse = [
  {
    id: 'membership-1',
    organization_id: 'org-1',
    user_id: 'user-1',
    invited_email: null,
    role: 'employee',
    status: 'active',
    member_position: 'Operario',
    department: 'General',
    hire_date: '2026-01-01',
    shift_duration_hours: 8,
    break_duration_hours: 0.75,
    weekly_hours: 40,
    full_name: 'Persona Uno',
    email: 'persona@empresa.com',
    phone: '+56911111111',
  },
];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: {
    open: jest.fn(),
  },
}));

jest.mock('@/components/header-user-menu', () => ({
  AppHeader: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'App Header');
  },
}));

jest.mock('@/components/organization-setup-view', () => ({
  OrganizationSetupView: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Organization Setup');
  },
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    colors: {
      background: {
        card: '#fff',
      },
      border: {
        default: '#ddd',
      },
      shadow: {
        color: '#000',
      },
      status: {
        error: '#f00',
      },
    },
    elevation: {
      card: {},
    },
    overlay: {
      scrim: 'rgba(0,0,0,0.4)',
    },
    radius: {
      lg: 12,
    },
    surface: {
      danger: '#fee',
      glass: {
        border: '#ddd',
        tint: '#fafafa',
      },
    },
    spacing: {
      sm: 8,
      lg: 16,
      '2xl': 32,
      '4xl': 48,
    },
  }),
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => mockOrganizationState,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(async (name: string) => {
      if (name === 'get_organization_team_members') {
        return { data: teamMembersResponse, error: null };
      }
      if (name === 'suspend_membership') {
        return {
          data: {
            success: true,
            membership_id: 'membership-1',
            status: 'suspended',
          },
          error: null,
        };
      }
      if (name === 'delete_membership') {
        return {
          data: { success: true, membership_id: 'membership-1' },
          error: null,
        };
      }
      return { data: null, error: null };
    }),
  },
}));

jest.mock('@/theme/primitives', () => ({
  Avatar: ({ initials }: { initials: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, initials);
  },
  Chip: ({ label, onPress }: { label: string; onPress?: () => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, label),
    );
  },
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, title),
      description ? React.createElement(Text, null, description) : null,
    );
  },
  FeedbackBlock: ({ message, title }: { message: string; title?: string }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(
      View,
      null,
      title ? React.createElement(Text, null, title) : null,
      React.createElement(Text, null, message),
    );
  },
  GlassCard: ({ children }: { children: ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, children);
  },
  PrimaryButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { disabled, onPress },
      React.createElement(Text, null, label),
    );
  },
  Screen: ({ children }: { children: ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, children);
  },
  SecondaryButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { disabled, onPress },
      React.createElement(Text, null, label),
    );
  },
  SectionHeader: ({
    title,
    subtitle,
    eyebrow,
  }: {
    title: string;
    subtitle?: string;
    eyebrow?: string;
  }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(
      View,
      null,
      eyebrow ? React.createElement(Text, null, eyebrow) : null,
      React.createElement(Text, null, title),
      subtitle ? React.createElement(Text, null, subtitle) : null,
    );
  },
  TextField: ({
    value,
    onChangeText,
    placeholder,
  }: {
    value?: string;
    onChangeText?: (value: string) => void;
    placeholder?: string;
  }) => {
    const React = require('react');
    const { TextInput } = require('react-native');
    return React.createElement(TextInput, {
      onChangeText,
      placeholder,
      value,
    });
  },
  ThemedText: ({ children }: { children: ReactNode }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, children);
  },
}));

describe('TeamScreen invitations entrypoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates to dedicated invitations screen', async () => {
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Gestionar invitaciones')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Gestionar invitaciones'));

    expect(mockPush).toHaveBeenCalledWith('/invitations');
  });

  it('shows member email and phone in card details', async () => {
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Email: persona@empresa.com')).toBeTruthy();
    });

    expect(screen.getByText('Teléfono: +56911111111')).toBeTruthy();
  });

  it('shows expel button for non-owner members when user can manage organization', async () => {
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Expulsar')).toBeTruthy();
    });
  });

  it('opens member action modal with Despedir and Eliminar explanations', async () => {
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Expulsar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Expulsar'));

    expect(
      screen.getByText('Elegí cómo querés expulsar a este miembro'),
    ).toBeTruthy();
    expect(screen.getByText('Despedir')).toBeTruthy();
    expect(
      screen.getByText('Desactiva el acceso y mantiene su historial.'),
    ).toBeTruthy();
    expect(screen.getByText('Eliminar')).toBeTruthy();
    expect(
      screen.getByText('Borra su membresía y el historial asociado.'),
    ).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  it('opens second confirmation modal before suspend_membership RPC', async () => {
    const { supabase } = require('@/lib/supabase');
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Expulsar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Expulsar'));
    fireEvent.press(screen.getByText('Despedir'));

    expect(screen.getByText('Confirmar despido')).toBeTruthy();
    expect(
      screen.getByText(
        'Se va a desactivar su acceso, pero no se elimina su historial.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('suspend_membership', {
        p_membership_id: 'membership-1',
      });
    });
  });

  it('opens second confirmation modal before delete_membership RPC', async () => {
    const { supabase } = require('@/lib/supabase');
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Expulsar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Expulsar'));
    fireEvent.press(screen.getByText('Eliminar'));

    expect(screen.getByText('Confirmar eliminación')).toBeTruthy();
    expect(
      screen.getByText(
        'Esta acción elimina la membresía y no se puede deshacer.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('delete_membership', {
        p_membership_id: 'membership-1',
      });
    });
  });

  it('does not call RPC when second confirmation modal is canceled', async () => {
    const { supabase } = require('@/lib/supabase');
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Expulsar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Expulsar'));
    fireEvent.press(screen.getByText('Eliminar'));

    expect(screen.getByText('Confirmar eliminación')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancelar'));

    expect(screen.queryByText('Confirmar despido')).toBeNull();

    await waitFor(() => {
      expect(screen.queryByText('Confirmar eliminación')).toBeNull();
    });

    expect(
      screen.queryByText('Elegí cómo querés expulsar a este miembro'),
    ).toBeNull();
    expect(
      screen.queryByText('Desactiva el acceso y mantiene su historial.'),
    ).toBeNull();

    expect(supabase.rpc).not.toHaveBeenCalledWith('delete_membership', {
      p_membership_id: 'membership-1',
    });
    expect(supabase.rpc).not.toHaveBeenCalledWith('suspend_membership', {
      p_membership_id: 'membership-1',
    });
  });

  it('closes expel menu when Cancelar is pressed', async () => {
    const screen = render(<TeamScreen />);

    await waitFor(() => {
      expect(screen.getByText('Expulsar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Expulsar'));
    expect(screen.getByText('Despedir')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancelar'));

    await waitFor(() => {
      expect(screen.getByText('Expulsar')).toBeTruthy();
    });
    expect(screen.queryByText('Despedir')).toBeNull();
  });
});
