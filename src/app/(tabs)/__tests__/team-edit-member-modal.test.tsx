import { fireEvent, render, screen } from '@testing-library/react-native';
import type { EditEmployeeFormValues } from '@/components/team/team-edit-form';
import { EditMemberModal } from '@/components/team/team-edit-member-modal';
import type { TeamMember } from '@/components/team/team-member';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    colors: {
      background: { card: '#fff' },
      border: { default: '#ccc' },
      shadow: { color: '#000' },
      status: { error: '#f00' },
    },
    elevation: { card: {} },
    radius: { lg: 12 },
    spacing: { '4xl': 32, sm: 8, lg: 16 },
    overlay: { scrim: 'rgba(0,0,0,0.4)' },
  }),
}));

jest.mock('@/lib/role-permission-summaries', () => ({
  ROLE_PERMISSION_SUMMARIES: {
    admin: { description: 'Admin permissions' },
    manager: { description: 'Manager permissions' },
    employee: { description: 'Employee permissions' },
    owner: { description: 'Owner permissions' },
  },
}));

jest.mock('@/theme/primitives', () => {
  const React = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');
  const text = (children: React.ReactNode) =>
    React.createElement(Text, null, children);
  const button = (label: string, onPress?: () => void) =>
    React.createElement(
      Pressable,
      { onPress, testID: `button-${label}` },
      text(label),
    );

  return {
    Chip: ({ label }: { label: string }) => text(label),
    FeedbackBlock: ({ message }: { message: string }) => text(message),
    GlassCard: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
    PrimaryButton: ({
      label,
      onPress,
    }: {
      label: string;
      onPress?: () => void;
    }) => button(label, onPress),
    SecondaryButton: ({
      label,
      onPress,
    }: {
      label: string;
      onPress?: () => void;
    }) => button(label, onPress),
    SectionHeader: ({ title }: { title: string }) => text(title),
    TextField: (props: {
      onBlur?: () => void;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) => React.createElement(TextInput, props),
    ThemedText: ({ children }: { children: React.ReactNode }) => text(children),
  };
});

const member: TeamMember = {
  breakDurationHours: 8,
  department: 'Operaciones',
  hireDate: '',
  id: 'member-1',
  initials: 'AL',
  email: 'ada@example.com',
  phone: '',
  name: 'Ada Lovelace',
  position: 'Supervisor',
  role: 'employee',
  roleLabel: 'Supervisor',
  shiftDurationHours: 8,
  weeklyHours: 40,
};

const ownerMember: TeamMember = { ...member, id: 'member-2', role: 'owner' };

const formValues: EditEmployeeFormValues = {
  breakDurationHours: '00:45',
  department: '',
  hireDate: '',
  position: '',
  role: 'employee',
  shiftDurationHours: '08:00',
  weeklyHours: '40',
};

function makeProps(
  overrides: Partial<Parameters<typeof EditMemberModal>[0]> = {},
) {
  return {
    activeOrganizationRole: 'owner' as const,
    editFormErrors: {},
    editFormMessage: '',
    editFormValues: { ...formValues },
    isHireDatePickerVisible: false,
    isSavingProfile: false,
    onCloseEditModal: jest.fn(),
    onHireDateChange: jest.fn(),
    onOpenHireDatePicker: jest.fn(),
    onSaveMemberProfile: jest.fn(),
    selectedMember: member,
    setEditFormValues: jest.fn(),
    setIsHireDatePickerVisible: jest.fn(),
    visible: true,
    ...overrides,
  };
}

describe('EditMemberModal', () => {
  it('renders nothing when no member is selected', () => {
    render(<EditMemberModal {...makeProps({ selectedMember: null })} />);

    expect(screen.queryByText('Perfil del empleado')).toBeNull();
  });

  it('renders header, schedule and edit sections', () => {
    render(<EditMemberModal {...makeProps()} />);

    expect(screen.getByText('Perfil del empleado')).toBeTruthy();
    expect(screen.getByDisplayValue('08:00')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ej: Supervisor de turno')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ej: Operaciones')).toBeTruthy();
    expect(screen.getByText('Administrador')).toBeTruthy();
    expect(screen.getByText('Fecha de contratación')).toBeTruthy();
    expect(screen.getByText('Guardar')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  it('hides position, department and role sections for owner members', () => {
    render(<EditMemberModal {...makeProps({ selectedMember: ownerMember })} />);

    expect(screen.queryByPlaceholderText('Ej: Supervisor de turno')).toBeNull();
    expect(screen.queryByText('Administrador')).toBeNull();
    expect(screen.getByText('Fecha de contratación')).toBeTruthy();
  });

  it('renders the form message when present', () => {
    render(
      <EditMemberModal
        {...makeProps({ editFormMessage: 'Revisá los campos marcados.' })}
      />,
    );

    expect(screen.getByText('Revisá los campos marcados.')).toBeTruthy();
  });

  it('saves the profile when Guardar is pressed', () => {
    const onSaveMemberProfile = jest.fn();
    render(<EditMemberModal {...makeProps({ onSaveMemberProfile })} />);

    fireEvent.press(screen.getByTestId('button-Guardar'));

    expect(onSaveMemberProfile).toHaveBeenCalledTimes(1);
  });

  it('closes the modal when Cancelar is pressed', () => {
    const onCloseEditModal = jest.fn();
    render(<EditMemberModal {...makeProps({ onCloseEditModal })} />);

    fireEvent.press(screen.getByTestId('button-Cancelar'));

    expect(onCloseEditModal).toHaveBeenCalledTimes(1);
  });
});
