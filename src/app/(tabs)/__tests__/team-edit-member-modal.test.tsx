import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { EditEmployeeFormValues } from '@/components/team/team-edit-form';
import { EditMemberModal } from '@/components/team/team-edit-member-modal';
import type { TeamMember } from '@/components/team/team-member';

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    colors: { background: { card: '#ffffff' } },
    overlay: { scrim: '#000000' },
  }),
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
    editFormErrors: {},
    editFormMessage: '',
    editFormValues: { ...formValues },
    isSavingProfile: false,
    onCloseEditModal: jest.fn(),
    onSaveMemberProfile: jest.fn(),
    selectedMember: member,
    setEditFormValues: jest.fn(),
    visible: true,
    ...overrides,
  };
}

describe('EditMemberModal', () => {
  it('renders nothing when no member is selected', () => {
    render(<EditMemberModal {...makeProps({ selectedMember: null })} />);

    expect(screen.queryByText('Perfil del empleado')).toBeNull();
  });

  it('renders the header, intro, schedule fields and children', () => {
    render(
      <EditMemberModal {...makeProps()}>
        <Text>Campos adicionales</Text>
      </EditMemberModal>,
    );

    expect(screen.getByText('Perfil del empleado')).toBeTruthy();
    expect(
      screen.getByText(
        'Ajustá la jornada, colación y datos del perfil laboral en una sola vista.',
      ),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('08:00')).toBeTruthy();
    expect(screen.getByText('Campos adicionales')).toBeTruthy();
    expect(screen.getByText('Guardar')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
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
