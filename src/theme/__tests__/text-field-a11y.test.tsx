import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { TextField } from '@/theme/primitives/TextField';

describe('TextField — L04 F11 accessible name and error semantics', () => {
  test('wires the label text to the input accessible name', () => {
    render(
      <TextField
        label="Email"
        placeholder="nombre@empresa.com"
        testID="input"
      />,
    );

    const input = screen.getByTestId('input');
    const label = screen.getByText('Email');

    expect(label.props.nativeID).toBeTruthy();
    expect(input.props.nativeID).toBeTruthy();
    expect(input.props.accessibilityLabelledBy).toEqual([label.props.nativeID]);
    expect(label.props.nativeID).not.toBe(input.props.nativeID);
  });

  test('exposes the same accessible-name wiring on web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(
      <TextField
        label="Email"
        placeholder="nombre@empresa.com"
        testID="input"
      />,
    );

    const input = screen.getByTestId('input');
    const label = screen.getByText('Email');

    expect(input.props.accessibilityLabelledBy).toEqual([label.props.nativeID]);
  });

  test('announces errors as a polite alert region linked to the input', () => {
    render(
      <TextField errorMessage="Email inválido" label="Email" testID="input" />,
    );

    const input = screen.getByTestId('input');
    const error = screen.getByText('Email inválido');

    expect(error.props.accessibilityRole).toBe('alert');
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expect(error.props.nativeID).toBeTruthy();
    expect(input.props.accessibilityDescribedBy).toBe(error.props.nativeID);
  });

  test('associates helper text without alert semantics', () => {
    render(<TextField helperText="Sin spam" label="Email" testID="input" />);

    const input = screen.getByTestId('input');
    const helper = screen.getByText('Sin spam');

    expect(helper.props.accessibilityRole).toBeUndefined();
    expect(helper.props.accessibilityLiveRegion).toBe('polite');
    expect(input.props.accessibilityDescribedBy).toBe(helper.props.nativeID);
  });

  test('keeps a caller accessibilityLabelledBy over the generated link', () => {
    render(
      <TextField
        accessibilityLabelledBy="external-label"
        label="Email"
        testID="input"
      />,
    );

    const input = screen.getByTestId('input');
    const label = screen.getByText('Email');

    expect(input.props.accessibilityLabelledBy).toBe('external-label');
    expect(label.props.nativeID).toBe(`${input.props.nativeID}-label`);
  });

  test('lets a caller accessibilityLabel win over the generated link', () => {
    render(
      <TextField
        accessibilityLabel="Email alternativo"
        label="Email"
        testID="input"
      />,
    );

    const input = screen.getByTestId('input');

    expect(input.props.accessibilityLabel).toBe('Email alternativo');
    expect(input.props.accessibilityLabelledBy).toBeUndefined();
  });

  test('keeps a caller nativeID and derives wiring ids from it', () => {
    render(<TextField label="Email" nativeID="email" testID="input" />);

    const input = screen.getByTestId('input');
    const label = screen.getByText('Email');

    expect(input.props.nativeID).toBe('email');
    expect(label.props.nativeID).toBe('email-label');
    expect(input.props.accessibilityLabelledBy).toEqual(['email-label']);
  });

  test('generates an input id without a label and no name link', () => {
    render(<TextField placeholder="Sin label" testID="input" />);

    const input = screen.getByTestId('input');

    expect(input.props.nativeID).toBeTruthy();
    expect(input.props.accessibilityLabelledBy).toBeUndefined();
  });

  test('omits the description link when no supporting text is shown', () => {
    render(<TextField label="Email" testID="input" />);

    expect(
      screen.getByTestId('input').props.accessibilityDescribedBy,
    ).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('keeps an explicit caller accessibilityDescribedBy', () => {
    render(
      <TextField
        accessibilityDescribedBy="external-note"
        label="Email"
        testID="input"
      />,
    );

    expect(screen.getByTestId('input').props.accessibilityDescribedBy).toBe(
      'external-note',
    );
  });
});
