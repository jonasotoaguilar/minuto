import { fireEvent, render, screen } from '@testing-library/react-native';
import { HireDateField } from '@/components/team/hire-date-field';
import type { EditEmployeeFormValues } from '@/components/team/team-edit-form';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: {
    open: jest.fn(),
  },
}));

jest.mock('@/theme/primitives', () => {
  const React = require('react');
  const { Pressable, Text, TextInput } = require('react-native');

  const Button = ({
    label,
    onPress,
  }: {
    label: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, label),
    );

  return {
    SecondaryButton: Button,
    TextField: ({
      value,
      onChangeText,
      placeholder,
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
    }) => React.createElement(TextInput, { onChangeText, placeholder, value }),
    ThemedText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

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

const formValues: EditEmployeeFormValues = {
  breakDurationHours: '00:45',
  department: '',
  hireDate: '15/01/2026',
  position: '',
  role: 'employee',
  shiftDurationHours: '08:00',
  weeklyHours: '40',
};

const baseProps = {
  editFormErrors: {},
  editFormValues: formValues,
  isHireDatePickerVisible: false,
  onHireDateChange: jest.fn(),
  onOpenHireDatePicker: jest.fn(),
  setEditFormValues: jest.fn(),
  setIsHireDatePickerVisible: jest.fn(),
};

describe('HireDateField', () => {
  it('renders the native date button with the selected date', () => {
    render(<HireDateField {...baseProps} />);

    expect(screen.getByText('15/01/2026')).toBeTruthy();
    expect(screen.queryByText('Seleccionar fecha')).toBeNull();
  });

  it('shows the placeholder when no date is selected', () => {
    render(
      <HireDateField
        {...baseProps}
        editFormValues={{ ...formValues, hireDate: '' }}
      />,
    );

    expect(screen.getByText('Seleccionar fecha')).toBeTruthy();
  });

  it('opens the native picker on press', () => {
    const onOpenHireDatePicker = jest.fn();
    render(
      <HireDateField
        {...baseProps}
        onOpenHireDatePicker={onOpenHireDatePicker}
      />,
    );

    fireEvent.press(screen.getByText('15/01/2026'));

    expect(onOpenHireDatePicker).toHaveBeenCalled();
  });
});
