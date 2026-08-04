import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import {
  FeedbackProvider,
  type FeedbackRequest,
  type FeedbackTone,
  resolveToneColors,
  useFeedback,
} from '@/theme/feedback';
import { resolveTheme } from '@/theme/provider';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

function CaptureButton({
  onId,
  request,
  testID = 'emit',
}: {
  onId?: (id: string) => void;
  request: FeedbackRequest;
  testID?: string;
}) {
  const feedback = useFeedback();
  return (
    <Pressable
      onPress={() => {
        const id = feedback.show(request);
        onId?.(id);
      }}
      testID={testID}
    >
      <Text>emit</Text>
    </Pressable>
  );
}

function DismissIdButton({ getId }: { getId: () => string }) {
  const feedback = useFeedback();
  return (
    <Pressable onPress={() => feedback.dismiss(getId())} testID="dismiss-id" />
  );
}

function renderProvider(request: FeedbackRequest, dismissLabel?: string) {
  render(
    <FeedbackProvider dismissLabel={dismissLabel}>
      <CaptureButton request={request} />
    </FeedbackProvider>,
  );
  fireEvent.press(screen.getByTestId('emit'));
}

const tick = (ms: number) => act(() => jest.advanceTimersByTime(ms));

function luminance(hex: string): number {
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const channels = [0, 2, 4].map(
    (i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255,
  );
  return (
    0.2126 * lin(channels[0]) +
    0.7152 * lin(channels[1]) +
    0.0722 * lin(channels[2])
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('FeedbackProvider core — L04 Slice B', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('success uses status semantics and error uses alert semantics', () => {
    renderProvider({ message: 'Turno guardado', tone: 'success' });

    const status = screen.getByRole('status');
    expect(status.props.accessibilityLiveRegion).toBe('polite');

    renderProvider({ message: 'Falló la conexión', tone: 'error' });
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('a new show replaces the current message and its timer', () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    let firstId = '';
    render(
      <FeedbackProvider>
        <CaptureButton
          onId={(id) => (firstId = id)}
          request={{ durationMs: 1000, message: 'A' }}
        />

        <CaptureButton
          request={{ durationMs: 5000, message: 'B' }}
          testID="emit-b"
        />
        <DismissIdButton getId={() => firstId} />
      </FeedbackProvider>,
    );
    fireEvent.press(screen.getByTestId('emit'));
    expect(firstId).toMatch(/^feedback-/);

    fireEvent.press(screen.getByTestId('emit-b'));

    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('B')).toBeTruthy();
    expect(clearSpy).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('dismiss-id'));
    expect(screen.getByText('B')).toBeTruthy();
    tick(1000);
    expect(screen.getByText('B')).toBeTruthy();

    tick(4000);
    expect(screen.queryByText('B')).toBeNull();
  });

  test('dismiss control removes the message and honors a custom label', () => {
    renderProvider({ message: 'Hola' });
    fireEvent.press(screen.getByLabelText('Descartar'));
    expect(screen.queryByText('Hola')).toBeNull();

    renderProvider({ message: 'Adiós' }, 'Cerrar');
    expect(screen.getByLabelText('Cerrar')).toBeTruthy();
  });

  test('auto-dismisses by duration and keeps zero-duration pinned', () => {
    renderProvider({ durationMs: 1000, message: 'Breve' });
    tick(999);
    expect(screen.getByText('Breve')).toBeTruthy();
    tick(1);
    expect(screen.queryByText('Breve')).toBeNull();

    renderProvider({ durationMs: 0, message: 'Fijado' });
    tick(60_000);
    expect(screen.getByText('Fijado')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Descartar'));
    expect(screen.queryByText('Fijado')).toBeNull();
  });

  test('invalid durations fall back to default; overflow is clamped', () => {
    for (const durationMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { getByTestId, getByText, queryByText } = render(
        <FeedbackProvider>
          <CaptureButton request={{ durationMs, message: 'Mensaje' }} />
        </FeedbackProvider>,
      );
      fireEvent.press(getByTestId('emit'));
      tick(3999);
      expect(getByText('Mensaje')).toBeTruthy();
      tick(1);
      expect(queryByText('Mensaje')).toBeNull();
    }

    const { getByTestId, getByText } = render(
      <FeedbackProvider>
        <CaptureButton request={{ durationMs: 2 ** 40, message: 'Largo' }} />
      </FeedbackProvider>,
    );
    fireEvent.press(getByTestId('emit'));
    tick(4000);
    expect(getByText('Largo')).toBeTruthy();
  });

  test('useFeedback throws outside a provider', () => {
    expect(() =>
      render(<CaptureButton request={{ message: 'Huérfano' }} />),
    ).toThrow('useFeedback must be used within a <FeedbackProvider>');
  });
});

describe('tone contrast — WCAG AA in both themes', () => {
  test('every tone/theme pair meets 4.5:1', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const tone of ['info', 'success', 'error'] as FeedbackTone[]) {
        const colors = resolveToneColors(resolveTheme(mode), tone);
        const ratio = contrast(colors.textColor, colors.backgroundColor);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
