import {
  TelemetryDeliverer,
  type TelemetryEvent,
} from '@/lib/telemetry-delivery';

type FetchMock = jest.Mock<
  Promise<Response>,
  [string, RequestInit | undefined]
>;

function okResponse(): Response {
  return { ok: true, status: 200 } as Response;
}

function failingResponse(): Response {
  return { ok: false, status: 500 } as Response;
}

function event(message: string, timestamp = 0): TelemetryEvent {
  return {
    type: 'error',
    timestamp,
    error: { name: 'Error', message },
    metadata: {},
  };
}

function waitForPendingToClear(deliverer: TelemetryDeliverer): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (deliverer.pendingCount === 0) {
        clearInterval(interval);
        resolve();
      }
    }, 5);
  });
}

describe('TelemetryDeliverer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is a safe no-op when no endpoint is configured', () => {
    const deliverer = new TelemetryDeliverer();

    expect(deliverer.enabled).toBe(false);
    deliverer.enqueue(event('boom'));
    expect(deliverer.pendingCount).toBe(0);
  });

  it('posts a structured event with POST, headers and JSON body', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(okResponse());
    const deliverer = new TelemetryDeliverer({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
    });

    deliverer.enqueue(event('clock-in failed', 1234));

    await waitForPendingToClear(deliverer);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toBe('https://telemetry.example.com/errors');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(String(init?.body)) as TelemetryEvent;
    expect(body.type).toBe('error');
    expect(body.timestamp).toBe(1234);
    expect(body.error.message).toBe('clock-in failed');
  });

  it('retries with backoff and drops the event after exhausting attempts', async () => {
    jest.useFakeTimers();
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(failingResponse());
    const deliverer = new TelemetryDeliverer({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
      maxAttempts: 3,
      attemptDelayMs: 500,
    });

    deliverer.enqueue(event('boom'));

    await jest.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(deliverer.pendingCount).toBe(0);
  });

  it('enters cooldown after consecutive failures and recovers later', async () => {
    let clock = 0;
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(failingResponse());
    const deliverer = new TelemetryDeliverer({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
      maxAttempts: 1,
      attemptDelayMs: 0,
      cooldownMs: 60_000,
      now: () => clock,
    });

    deliverer.enqueue(event('one'));
    deliverer.enqueue(event('two'));
    deliverer.enqueue(event('three'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deliverer.isCoolingDown(clock)).toBe(true);

    deliverer.enqueue(event('four'));
    expect(deliverer.pendingCount).toBe(0);

    clock = 60_001;

    expect(deliverer.isCoolingDown(clock)).toBe(false);
    deliverer.enqueue(event('five', clock));
    expect(deliverer.pendingCount).toBe(1);
  });

  it('aborts in-flight fetches after the timeout', async () => {
    jest.useFakeTimers();
    const fetchMock: FetchMock = jest.fn(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const deliverer = new TelemetryDeliverer({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
      maxAttempts: 1,
      fetchTimeoutMs: 2_000,
    });

    deliverer.enqueue(event('boom'));

    await jest.advanceTimersByTimeAsync(2_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deliverer.pendingCount).toBe(0);
  });

  it('never rejects when the endpoint is unreachable', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockRejectedValue(new Error('offline'));
    const deliverer = new TelemetryDeliverer({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
      maxAttempts: 2,
      attemptDelayMs: 0,
    });

    deliverer.enqueue(event('boom'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deliverer.pendingCount).toBe(0);
  });
});
