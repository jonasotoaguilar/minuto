import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TeamMember } from '@/components/team/team-member';
import { TeamMemberCard } from '@/components/team/team-member-card';

jest.mock('@/theme/primitives', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  const Button = ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
  }) =>
    React.createElement(
      Pressable,
      { disabled, onPress },
      React.createElement(Text, null, label),
    );

  return {
    Avatar: ({ initials }: { initials: string }) =>
      React.createElement(Text, null, initials),
    Chip: ({ label }: { label: string }) =>
      React.createElement(Text, null, label),
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SecondaryButton: Button,
    ThemedText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

const member = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  breakDurationHours: 0.75,
  department: 'General',
  hireDate: '2026-01-01',
  id: 'membership-1',
  initials: 'JU',
  email: 'juan@empresa.com',
  phone: '+56911111111',
  name: 'Juan Pérez',
  position: 'Operario',
  role: 'employee',
  roleLabel: 'Operario',
  shiftDurationHours: 8,
  weeklyHours: 40,
  ...overrides,
});

const renderCard = (
  memberOverrides: Partial<TeamMember> = {},
  props: Partial<Parameters<typeof TeamMemberCard>[0]> = {},
) =>
  render(
    <TeamMemberCard
      canManageOrganization
      isApplyingMemberAction={false}
      member={member(memberOverrides)}
      onEditMember={jest.fn()}
      onExpel={jest.fn()}
      {...props}
    />,
  );

describe('TeamMemberCard', () => {
  it('renders member identity, role and contact details', () => {
    renderCard();

    expect(screen.getByText('Juan Pérez')).toBeTruthy();
    expect(screen.getByText('Operario')).toBeTruthy();
    expect(screen.getByText('Empleado')).toBeTruthy();
    expect(screen.getByText('Departamento: General')).toBeTruthy();
    expect(screen.getByText('Email: juan@empresa.com')).toBeTruthy();
    expect(screen.getByText('Teléfono: +56911111111')).toBeTruthy();
  });

  it('shows fallback copy for missing email and phone', () => {
    renderCard({ email: '', phone: '' });

    expect(screen.getByText('Email: Sin email')).toBeTruthy();
    expect(screen.getByText('Teléfono: Sin teléfono')).toBeTruthy();
  });

  it('hides management actions when the caller cannot manage the organization', () => {
    renderCard({}, { canManageOrganization: false });

    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Expulsar')).toBeNull();
  });

  it('hides the expel action for the owner role', () => {
    renderCard({ role: 'owner', roleLabel: 'Organization Owner' });

    expect(screen.getByText('Editar')).toBeTruthy();
    expect(screen.queryByText('Expulsar')).toBeNull();
  });

  it('reports edit presses with the member', () => {
    const onEditMember = jest.fn();
    renderCard({}, { onEditMember });

    fireEvent.press(screen.getByText('Editar'));

    expect(onEditMember).toHaveBeenCalledWith(member());
  });

  it('reports expel presses with the member', () => {
    const onExpel = jest.fn();
    renderCard({}, { onExpel });

    fireEvent.press(screen.getByText('Expulsar'));

    expect(onExpel).toHaveBeenCalledWith(member());
  });
});
