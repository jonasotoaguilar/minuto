import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { TeamMember } from '@/components/team/team-member';
import { TeamMemberList } from '@/components/team/team-member-list';

jest.mock('@/theme/primitives', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    EmptyState: ({
      title,
      description,
    }: {
      title: string;
      description?: string;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, title),
        description ? React.createElement(Text, null, description) : null,
      ),
    ThemedText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock('@/components/team/team-member-card', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    TeamMemberCard: ({
      member,
      onEditMember,
    }: {
      member: TeamMember;
      onEditMember: (member: TeamMember) => void;
    }) =>
      React.createElement(
        Pressable,
        { onPress: () => onEditMember(member) },
        React.createElement(Text, null, member.name),
      ),
  };
});

const member = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  breakDurationHours: 0.75,
  department: 'General',
  hireDate: '2026-01-01',
  id: 'membership-1',
  initials: 'JU',
  email: 'juan@empresa.com',
  phone: '',
  name: 'Juan Pérez',
  position: 'Operario',
  role: 'employee',
  roleLabel: 'Operario',
  shiftDurationHours: 8,
  weeklyHours: 40,
  ...overrides,
});

const members: TeamMember[] = [
  member({ id: 'm1', name: 'Ana Pérez' }),
  member({ id: 'm2', name: 'Luis Soto' }),
  member({ id: 'm3', name: 'Caro Díaz' }),
];

const baseProps = {
  canManageOrganization: true,
  contentContainerStyle: undefined,
  isApplyingMemberAction: false,
  isLoadingMembers: false,
  ListHeaderComponent: null,
  onEditMember: jest.fn(),
  onExpel: jest.fn(),
};

describe('TeamMemberList', () => {
  it('renders every member card', () => {
    render(<TeamMemberList {...baseProps} members={members} />);

    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Luis Soto')).toBeTruthy();
    expect(screen.getByText('Caro Díaz')).toBeTruthy();
  });

  it('renders the empty state when there are no members', () => {
    render(<TeamMemberList {...baseProps} members={[]} />);

    expect(screen.getByText('Sin miembros')).toBeTruthy();
    expect(screen.getByText('No hay miembros para ese filtro.')).toBeTruthy();
  });

  it('shows the loading label instead of the empty state while loading', () => {
    render(<TeamMemberList {...baseProps} isLoadingMembers members={[]} />);

    expect(screen.getByText('Cargando miembros...')).toBeTruthy();
    expect(screen.queryByText('Sin miembros')).toBeNull();
  });

  it('keeps rendering members while a reload is in progress', () => {
    render(
      <TeamMemberList {...baseProps} isLoadingMembers members={members} />,
    );

    expect(screen.getByText('Cargando miembros...')).toBeTruthy();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
  });

  it('renders the header content above the list', () => {
    render(
      <TeamMemberList
        {...baseProps}
        ListHeaderComponent={<Text>Header content</Text>}
        members={[]}
      />,
    );

    expect(screen.getByText('Header content')).toBeTruthy();
  });

  it('forwards member interactions to the callbacks', () => {
    const onEditMember = jest.fn();
    render(
      <TeamMemberList
        {...baseProps}
        members={members}
        onEditMember={onEditMember}
      />,
    );

    fireEvent.press(screen.getByText('Luis Soto'));

    expect(onEditMember).toHaveBeenCalledWith(members[1]);
  });
});
