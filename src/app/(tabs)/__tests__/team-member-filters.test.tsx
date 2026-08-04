import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import type { TeamMember } from '@/components/team/team-member';
import { TeamMemberFilters } from '@/components/team/team-member-filters';

jest.mock('@/theme/primitives', () => {
  const React = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');

  return {
    Chip: ({
      label,
      onPress,
      selected,
    }: {
      label: string;
      onPress?: () => void;
      selected?: boolean;
    }) =>
      React.createElement(
        Pressable,
        { onPress, testID: selected ? 'chip-selected' : 'chip' },
        React.createElement(Text, null, label),
      ),
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SectionHeader: ({
      title,
      subtitle,
      eyebrow,
    }: {
      title: string;
      subtitle?: string;
      eyebrow?: string;
    }) =>
      React.createElement(
        View,
        null,
        eyebrow ? React.createElement(Text, null, eyebrow) : null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
      ),
    TextField: ({
      value,
      onChangeText,
      placeholder,
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
    }) => React.createElement(TextInput, { onChangeText, placeholder, value }),
  };
});

const members: TeamMember[] = [
  {
    breakDurationHours: 0.75,
    department: 'Operaciones',
    hireDate: '2026-01-01',
    id: 'm1',
    initials: 'AN',
    email: 'ana@empresa.com',
    phone: '',
    name: 'Ana Pérez',
    position: 'Operario',
    role: 'employee',
    roleLabel: 'Operario',
    shiftDurationHours: 8,
    weeklyHours: 40,
  },
  {
    breakDurationHours: 0.75,
    department: 'General',
    hireDate: '2026-01-01',
    id: 'm2',
    initials: 'LU',
    email: 'luis@empresa.com',
    phone: '',
    name: 'Luis Soto',
    position: '',
    role: 'employee',
    roleLabel: 'Empleado',
    shiftDurationHours: 8,
    weeklyHours: 40,
  },
];

describe('TeamMemberFilters', () => {
  it('renders the search input with the current query', () => {
    render(
      <TeamMemberFilters
        members={members}
        onDepartmentChange={jest.fn()}
        onSearchChange={jest.fn()}
        searchQuery="ana"
        selectedDepartment="ALL"
      />,
    );

    expect(
      screen.getByPlaceholderText('Buscar miembros del equipo...'),
    ).toHaveProp('value', 'ana');
  });

  it('derives unique department chips plus the ALL chip', () => {
    render(
      <TeamMemberFilters
        members={members}
        onDepartmentChange={jest.fn()}
        onSearchChange={jest.fn()}
        searchQuery=""
        selectedDepartment="ALL"
      />,
    );

    expect(screen.getByText('TODOS')).toBeTruthy();
    expect(screen.getByText('OPERACIONES')).toBeTruthy();
    expect(screen.getByText('GENERAL')).toBeTruthy();
    expect(screen.queryByText('Operaciones')).toBeNull();
  });

  it('marks the selected department chip as selected', () => {
    render(
      <TeamMemberFilters
        members={members}
        onDepartmentChange={jest.fn()}
        onSearchChange={jest.fn()}
        searchQuery=""
        selectedDepartment="Operaciones"
      />,
    );

    expect(screen.getByTestId('chip-selected')).toBeTruthy();
    expect(screen.getAllByTestId('chip')).toHaveLength(2);
    expect(
      within(screen.getByTestId('chip-selected')).getByText('OPERACIONES'),
    ).toBeTruthy();
  });

  it('reports department changes', () => {
    const onDepartmentChange = jest.fn();
    render(
      <TeamMemberFilters
        members={members}
        onDepartmentChange={onDepartmentChange}
        onSearchChange={jest.fn()}
        searchQuery=""
        selectedDepartment="ALL"
      />,
    );

    fireEvent.press(screen.getByText('OPERACIONES'));

    expect(onDepartmentChange).toHaveBeenCalledWith('Operaciones');
  });

  it('reports search changes', () => {
    const onSearchChange = jest.fn();
    render(
      <TeamMemberFilters
        members={members}
        onDepartmentChange={jest.fn()}
        onSearchChange={onSearchChange}
        searchQuery=""
        selectedDepartment="ALL"
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('Buscar miembros del equipo...'),
      'luis',
    );

    expect(onSearchChange).toHaveBeenCalledWith('luis');
  });
});
