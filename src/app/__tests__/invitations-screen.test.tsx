import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import InvitationsScreen from '@/app/invitations';
import {
  createMembershipInvitation,
  listPendingMembershipInvitations,
  revokeMembershipInvitation,
} from '@/lib/organization-invitations';

const mockOrganizationState = {
  activeOrganization: {
    id: 'org-1',
    membershipRole: 'owner',
    name: 'Acme',
  },
  isLoadingOrganizations: false,
  isOrganizationSetupOpen: false,
};

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
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
      background: { card: '#fff' },
      border: { default: '#ddd' },
      shadow: { color: '#000' },
      status: { error: '#f00' },
    },
    elevation: { card: {} },
    overlay: { scrim: 'rgba(0,0,0,0.4)' },
    radius: { lg: 12 },
    surface: {
      danger: '#fee',
      glass: { border: '#ddd', tint: '#fafafa' },
    },
    spacing: { sm: 8, lg: 16, '2xl': 32, '4xl': 48 },
  }),
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => mockOrganizationState,
}));

jest.mock('@/lib/organization-invitations', () => ({
  createMembershipInvitation: jest.fn(),
  listPendingMembershipInvitations: jest.fn(),
  revokeMembershipInvitation: jest.fn(),
}));

jest.mock('@/theme/primitives', () => ({
  Chip: ({ label, onPress }: { label: string; onPress?: () => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, label),
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
  }: {
    label: string;
    onPress?: () => void;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { onPress },
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
  }: {
    label: string;
    onPress?: () => void;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, label),
    );
  },
  SectionHeader: ({
    title,
    subtitle,
  }: {
    title: string;
    subtitle?: string;
  }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(
      View,
      null,
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
    return React.createElement(TextInput, { onChangeText, placeholder, value });
  },
  ThemedText: ({ children }: { children: ReactNode }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, children);
  },
}));

describe('InvitationsScreen', () => {
  const mockedCreate = createMembershipInvitation as jest.Mock;
  const mockedList = listPendingMembershipInvitations as jest.Mock;
  const mockedRevoke = revokeMembershipInvitation as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedList.mockResolvedValue([
      {
        createdAt: null,
        id: 'invite-1',
        invitedEmail: 'persona@empresa.com',
        invitationCode: 'ABCD1',
        invitationExpiresAt: '2026-05-01T10:00:00.000Z',
        organizationId: 'org-1',
        role: 'employee',
        status: 'invited',
      },
    ]);
  });

  it('copies invitation code with expo-clipboard', async () => {
    const screen = render(<InvitationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('persona@empresa.com')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Copiar código'));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABCD1');
    });
  });

  it('revokes pending invitation from dedicated list', async () => {
    mockedRevoke.mockResolvedValue({
      id: 'invite-1',
      organizationId: 'org-1',
      status: 'revoked',
    });

    const screen = render(<InvitationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('persona@empresa.com')).toBeTruthy();
    });

    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    fireEvent.press(screen.getByText('Revocar'));

    const alertButtons = alertSpy.mock.calls[0]?.[2] as
      | { onPress?: () => void; text: string }[]
      | undefined;
    await act(async () => {
      alertButtons?.find((button) => button.text === 'Revocar')?.onPress?.();
    });

    await waitFor(() => {
      expect(mockedRevoke).toHaveBeenCalledWith('invite-1');
    });

    alertSpy.mockRestore();
  });

  it('renew flow updates existing invitation instead of duplicating in UI', async () => {
    mockedCreate.mockResolvedValue({
      createdAt: null,
      id: 'invite-1',
      invitedEmail: 'persona@empresa.com',
      invitationCode: 'NEWCODE',
      invitationExpiresAt: '2026-05-08T10:00:00.000Z',
      organizationId: 'org-1',
      role: 'employee',
      status: 'invited',
    });

    const screen = render(<InvitationsScreen />);

    await waitFor(() => {
      expect(screen.getByText('persona@empresa.com')).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('nombre@empresa.com'),
      'persona@empresa.com',
    );
    const createInvitationAction = screen
      .getAllByText('Crear invitación')
      .at(-1);
    expect(createInvitationAction).toBeTruthy();

    fireEvent.press(createInvitationAction!);

    await waitFor(() => {
      expect(screen.getAllByText('persona@empresa.com')).toHaveLength(1);
      expect(screen.getByText('Código: NEWCODE')).toBeTruthy();
    });
  });
});
