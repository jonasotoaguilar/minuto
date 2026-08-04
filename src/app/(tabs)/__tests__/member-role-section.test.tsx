import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { useState } from 'react';
import { MemberRoleSection } from '@/components/team/member-role-section';
import type { EditEmployeeFormValues } from '@/components/team/team-edit-form';

jest.mock('@/theme/primitives', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

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
    ThemedText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock('@/lib/role-permission-summaries', () => ({
  ROLE_PERMISSION_SUMMARIES: {
    admin: { description: 'Admin permissions' },
    manager: { description: 'Manager permissions' },
    employee: { description: 'Employee permissions' },
    owner: { description: 'Owner permissions' },
  },
}));

const formValues: EditEmployeeFormValues = {
  breakDurationHours: '00:45',
  department: '',
  hireDate: '',
  position: '',
  role: 'manager',
  shiftDurationHours: '08:00',
  weeklyHours: '40',
};

function Harness() {
  const [values, setValues] = useState(formValues);
  return (
    <MemberRoleSection
      allowedRoles={['admin', 'manager', 'employee']}
      editFormErrors={{}}
      editFormValues={values}
      setEditFormValues={setValues}
    />
  );
}

describe('MemberRoleSection', () => {
  it('renders role chips with the allowed roles', () => {
    render(<Harness />);

    expect(screen.getByText('Administrador')).toBeTruthy();
    expect(screen.getByText('Manager')).toBeTruthy();
    expect(screen.getByText('Empleado')).toBeTruthy();
    expect(screen.getByText('Manager permissions')).toBeTruthy();
  });

  it('marks the selected role chip', () => {
    render(<Harness />);

    expect(screen.getAllByTestId('chip-selected')).toHaveLength(1);
    expect(
      within(screen.getByTestId('chip-selected')).getByText('Manager'),
    ).toBeTruthy();
  });

  it('updates the role on chip press', () => {
    render(<Harness />);

    fireEvent.press(screen.getByText('Empleado'));

    expect(screen.getByText('Employee permissions')).toBeTruthy();
  });
});
