import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import type { EditEmployeeFormValues } from '@/components/team/team-edit-form';
import { WorkScheduleFields } from '@/components/team/work-schedule-fields';

jest.mock('@/theme/primitives', () => {
  const React = require('react');
  const { TextInput } = require('react-native');

  return {
    TextField: ({
      value,
      onChangeText,
      onBlur,
      placeholder,
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      onBlur?: () => void;
      placeholder?: string;
    }) =>
      React.createElement(TextInput, {
        onBlur,
        onChangeText,
        placeholder,
        value,
      }),
  };
});

const formValues: EditEmployeeFormValues = {
  breakDurationHours: '00:45',
  department: '',
  hireDate: '',
  position: '',
  role: 'employee',
  shiftDurationHours: '08:00',
  weeklyHours: '40',
};

function Harness() {
  const [values, setValues] = useState(formValues);
  return (
    <WorkScheduleFields
      editFormErrors={{}}
      editFormValues={values}
      setEditFormValues={setValues}
    />
  );
}

describe('WorkScheduleFields', () => {
  it('renders the three schedule fields with their values', () => {
    render(<Harness />);

    expect(screen.getByPlaceholderText('08:00')).toHaveProp('value', '08:00');
    expect(screen.getByPlaceholderText('00:45')).toHaveProp('value', '00:45');
    expect(screen.getByPlaceholderText('40')).toHaveProp('value', '40');
  });

  it('updates the shift hours field', () => {
    render(<Harness />);

    fireEvent.changeText(screen.getByPlaceholderText('08:00'), '09:30');

    expect(screen.getByPlaceholderText('08:00')).toHaveProp('value', '09:30');
  });

  it('normalizes compact time input on blur', () => {
    render(<Harness />);

    fireEvent.changeText(screen.getByPlaceholderText('08:00'), '830');
    fireEvent(screen.getByPlaceholderText('08:00'), 'blur');

    expect(screen.getByPlaceholderText('08:00')).toHaveProp('value', '08:30');
  });

  it('updates the break and weekly fields', () => {
    render(<Harness />);

    fireEvent.changeText(screen.getByPlaceholderText('00:45'), '01:00');
    fireEvent.changeText(screen.getByPlaceholderText('40'), '36');

    expect(screen.getByPlaceholderText('00:45')).toHaveProp('value', '01:00');
    expect(screen.getByPlaceholderText('40')).toHaveProp('value', '36');
  });
});
