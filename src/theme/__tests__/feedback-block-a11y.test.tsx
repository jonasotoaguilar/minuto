import { render, screen } from '@testing-library/react-native';

import { FeedbackBlock } from '@/theme/primitives/FeedbackBlock';

describe('FeedbackBlock — L04 F11 error announcement', () => {
  test('marks the error tone as a polite alert region', () => {
    render(<FeedbackBlock message="Falló la conexión" tone="error" />);

    const alert = screen.getByRole('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('Falló la conexión')).toBeTruthy();
  });

  test('leaves non-error tones without alert semantics', () => {
    render(<FeedbackBlock message="Guardado" tone="success" />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
