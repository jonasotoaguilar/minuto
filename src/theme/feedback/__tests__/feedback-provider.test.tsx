import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StrictMode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import {
  type FeedbackContextValue,
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
  mode = 'show',
  onId,
  request,
  testID = 'emit',
}: {
  mode?: 'enqueue' | 'show';
  onId?: (id: string) => void;
  request: FeedbackRequest;
  testID?: string;
}) {
  const feedback = useFeedback();
  return (
    <Pressable
      onPress={() => {
        const id =
          mode === 'enqueue'
            ? feedback.enqueue(request)
            : feedback.show(request);
        onId?.(id);
      }}
      testID={testID}
    >
      <Text>emit</Text>
    </Pressable>
  );
}

function FeedbackActionButton({
  onPress,
  testID,
}: {
  onPress: (feedback: FeedbackContextValue) => void;
  testID: string;
}) {
  const feedback = useFeedback();
  return (
    <Pressable onPress={() => onPress(feedback)} testID={testID}>
      <Text>go</Text>
    </Pressable>
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
        <FeedbackActionButton
          onPress={(feedback) => feedback.dismiss(firstId)}
          testID="dismiss-id"
        />
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

  test('enqueue shows messages FIFO one at a time', () => {
    render(
      <FeedbackProvider>
        <CaptureButton
          mode="enqueue"
          request={{ durationMs: 0, message: 'Uno' }}
        />
        <CaptureButton
          mode="enqueue"
          request={{ durationMs: 0, message: 'Dos' }}
          testID="emit-dos"
        />
      </FeedbackProvider>,
    );
    fireEvent.press(screen.getByTestId('emit'));
    fireEvent.press(screen.getByTestId('emit-dos'));

    expect(screen.getByText('Uno')).toBeTruthy();
    expect(screen.queryByText('Dos')).toBeNull();

    fireEvent.press(screen.getByLabelText('Descartar'));
    expect(screen.queryByText('Uno')).toBeNull();
    expect(screen.getByText('Dos')).toBeTruthy();
  });

  test('show replaces the active message and clears the queue', () => {
    render(
      <FeedbackProvider>
        <CaptureButton
          mode="enqueue"
          request={{ durationMs: 0, message: 'A' }}
        />
        <CaptureButton
          mode="enqueue"
          request={{ durationMs: 0, message: 'B' }}
          testID="emit-b"
        />
        <CaptureButton request={{ message: 'X' }} testID="emit-x" />
      </FeedbackProvider>,
    );
    fireEvent.press(screen.getByTestId('emit'));
    fireEvent.press(screen.getByTestId('emit-b'));
    fireEvent.press(screen.getByTestId('emit-x'));

    expect(screen.getByText('X')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();

    tick(4000);
    expect(screen.queryByText('X')).toBeNull();
    expect(screen.queryByText('B')).toBeNull();
  });

  test('dismissAll clears active and queued messages and their timers', () => {
    render(
      <FeedbackProvider>
        <CaptureButton mode="enqueue" request={{ message: 'A' }} />
        <CaptureButton
          mode="enqueue"
          request={{ message: 'B' }}
          testID="emit-b"
        />
        <FeedbackActionButton
          onPress={(feedback) => feedback.dismissAll()}
          testID="dismiss-all"
        />
      </FeedbackProvider>,
    );
    fireEvent.press(screen.getByTestId('emit'));
    fireEvent.press(screen.getByTestId('emit-b'));
    fireEvent.press(screen.getByTestId('dismiss-all'));

    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('B')).toBeNull();

    tick(60_000);
    expect(screen.queryByText('A')).toBeNull();
  });

  test('dismissing a queued message skips it without touching the active one', () => {
    let queuedId = '';
    render(
      <FeedbackProvider>
        <CaptureButton
          mode="enqueue"
          request={{ durationMs: 0, message: 'A' }}
        />
        <CaptureButton
          mode="enqueue"
          onId={(id) => (queuedId = id)}
          request={{ durationMs: 0, message: 'B' }}
          testID="emit-b"
        />
        <FeedbackActionButton
          onPress={(feedback) => feedback.dismiss(queuedId)}
          testID="dismiss-queued"
        />
      </FeedbackProvider>,
    );
    fireEvent.press(screen.getByTestId('emit'));
    fireEvent.press(screen.getByTestId('emit-b'));
    fireEvent.press(screen.getByTestId('dismiss-queued'));

    expect(screen.getByText('A')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Descartar'));
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('B')).toBeNull();
  });

  test('queued messages get their own timer only once active', () => {
    render(
      <FeedbackProvider>
        <CaptureButton
          mode="enqueue"
          request={{ durationMs: 1000, message: 'A' }}
        />
        <CaptureButton
          mode="enqueue"
          request={{ durationMs: 3000, message: 'B' }}
          testID="emit-b"
        />
      </FeedbackProvider>,
    );
    fireEvent.press(screen.getByTestId('emit'));
    fireEvent.press(screen.getByTestId('emit-b'));

    tick(1000);
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('B')).toBeTruthy();

    tick(3000);
    expect(screen.queryByText('B')).toBeNull();
  });

  test('action runs once after dismissal; auto-dismiss never calls it', () => {
    const onAction = jest.fn();
    render(
      <FeedbackProvider>
        <CaptureButton
          request={{
            actionLabel: 'Reintentar',
            durationMs: 0,
            message: 'Falló',
            onAction,
          }}
        />
        <CaptureButton
          request={{ durationMs: 2000, message: 'Sin acción', onAction }}
          testID="emit-b"
        />
      </FeedbackProvider>,
    );
    fireEvent.press(screen.getByTestId('emit'));
    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Falló')).toBeNull();

    fireEvent.press(screen.getByTestId('emit-b'));
    tick(2000);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('skips the entrance animation when reduce motion is enabled', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const timingSpy = jest.spyOn(Animated, 'timing');
    const { getByTestId } = render(
      <FeedbackProvider>
        <CaptureButton request={{ message: 'Calmado' }} />
      </FeedbackProvider>,
    );
    await act(async () => {
      // flush the reduce-motion preference
    });
    fireEvent.press(getByTestId('emit'));

    expect(screen.getByText('Calmado')).toBeTruthy();
    expect(timingSpy).not.toHaveBeenCalled();
  });

  test('animates the entrance when motion is allowed', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    const timingSpy = jest.spyOn(Animated, 'timing');
    const { getByTestId } = render(
      <FeedbackProvider>
        <CaptureButton request={{ message: 'Animado' }} />
      </FeedbackProvider>,
    );
    await act(async () => {
      // flush the reduce-motion preference
    });
    fireEvent.press(getByTestId('emit'));

    expect(timingSpy).toHaveBeenCalled();
  });

  test('stays consistent under StrictMode double effects', () => {
    render(
      <StrictMode>
        <FeedbackProvider>
          <CaptureButton request={{ message: 'Estricto' }} />
        </FeedbackProvider>
      </StrictMode>,
    );
    fireEvent.press(screen.getByTestId('emit'));

    tick(4000);
    expect(screen.queryByText('Estricto')).toBeNull();
  });

  test('host uses a valid absolute position and sits at the top', () => {
    renderProvider({ message: 'Arriba' });

    const style = StyleSheet.flatten(
      screen.getByTestId('feedback-host').props.style,
    );

    expect(style.position).toBe('absolute');
    expect(style.top).toBeGreaterThanOrEqual(0);
    expect(style.left).toBe(0);
    expect(style.right).toBe(0);
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
