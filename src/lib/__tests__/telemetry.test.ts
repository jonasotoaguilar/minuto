import { TelemetryReporter } from '@/lib/telemetry';
import { setRouteContext } from '@/lib/telemetry-context';
import type { TelemetryEvent } from '@/lib/telemetry-delivery';

type FetchMock = jest.Mock<
  Promise<Response>,
  [string, RequestInit | undefined]
>;

function okResponse(): Response {
  return { ok: true, status: 200 } as Response;
}

function waitForPendingToClear(reporter: TelemetryReporter): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (reporter.pendingCount === 0) {
        clearInterval(interval);
        resolve();
      }
    }, 5);
  });
}

describe('TelemetryReporter', () => {
  afterEach(() => {
    setRouteContext(undefined);
  });

  it('is a safe no-op when no endpoint is configured', () => {
    const reporter = new TelemetryReporter();

    expect(reporter.enabled).toBe(false);
    expect(reporter.captureError(new Error('boom'))).toBe(false);
    expect(reporter.pendingCount).toBe(0);
  });

  it('is a safe no-op when fetch is unavailable', () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: undefined,
    });

    try {
      const reporter = new TelemetryReporter({
        endpoint: 'https://telemetry.example.com/errors',
        fetchImpl: undefined,
      });

      expect(reporter.enabled).toBe(false);
      expect(reporter.captureError(new Error('boom'))).toBe(false);
      expect(reporter.pendingCount).toBe(0);
    } finally {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: originalFetch,
      });
    }
  });

  it('does not throw when an endpoint is configured but invalid', () => {
    const fetchMock: FetchMock = jest.fn().mockRejectedValue(new Error('ERR'));
    const reporter = new TelemetryReporter({
      endpoint: 'not-a-url',
      fetchImpl: fetchMock,
      maxAttempts: 1,
    });

    expect(() => reporter.captureError(new Error('boom'))).not.toThrow();
  });

  it('posts a structured event with route, operation and session presence', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(okResponse());
    const reporter = new TelemetryReporter({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
    });

    const error = new Error('clock-in failed');
    reporter.captureError(error, {
      route: '/control',
      operation: 'attendance.clockIn',
      sessionPresent: true,
      metadata: { attempt: 2 },
    });

    await waitForPendingToClear(reporter);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1]?.body),
    ) as TelemetryEvent;
    expect(body.type).toBe('error');
    expect(body.route).toBe('/control');
    expect(body.operation).toBe('attendance.clockIn');
    expect(body.sessionPresent).toBe(true);
    expect(body.error.name).toBe('Error');
    expect(body.error.message).toBe('clock-in failed');
    expect(body.metadata).toEqual({ attempt: 2 });
  });

  it('falls back to the ambient route context when none is passed', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(okResponse());
    const reporter = new TelemetryReporter({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
    });

    setRouteContext('/team');
    reporter.captureError(new Error('boom'));

    await waitForPendingToClear(reporter);

    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1]?.body),
    ) as TelemetryEvent;
    expect(body.route).toBe('/team');
  });

  it('never includes credentials or tokens in posted metadata', async () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(okResponse());
    const reporter = new TelemetryReporter({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
    });

    reporter.captureError(new Error('boom'), {
      operation: 'team.update',
      metadata: {
        email: 'user@example.com',
        password: 'hunter2',
        accessToken: 'ey.jwt.secret',
        headers: { authorization: 'Bearer abc.def' },
        url: 'https://user:pass@api.example.com/v1',
      },
    });

    await waitForPendingToClear(reporter);

    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1]?.body),
    ) as TelemetryEvent;
    expect(body.metadata).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      headers: { authorization: '[REDACTED]' },
      url: 'https://[REDACTED]@api.example.com/v1',
    });
    expect(JSON.stringify(body)).not.toMatch(
      /hunter2|ey\.jwt\.secret|abc\.def|user:pass/,
    );
  });

  it('bounds the queue by dropping the oldest event when full', async () => {
    const fetchMock: FetchMock = jest.fn(
      (_input: string, _init: RequestInit | undefined) =>
        new Promise<Response>((resolve) => {
          setTimeout(() => resolve(okResponse()), 0);
        }),
    );
    const reporter = new TelemetryReporter({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
      maxQueueSize: 2,
    });

    reporter.captureError(new Error('first'));
    reporter.captureError(new Error('second'));
    reporter.captureError(new Error('third'));

    expect(reporter.pendingCount).toBe(2);

    await waitForPendingToClear(reporter);

    const bodies = fetchMock.mock.calls.map(
      ([, init]) =>
        (JSON.parse(String(init?.body)) as TelemetryEvent).error.message,
    );
    expect(bodies).toEqual(['first', 'second', 'third']);
  });

  it('deduplicates identical error signatures within the window', () => {
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(okResponse());
    const reporter = new TelemetryReporter({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
      dedupeWindowMs: 60_000,
    });

    expect(reporter.captureError(new Error('same'), { route: '/a' })).toBe(
      true,
    );
    expect(reporter.captureError(new Error('same'), { route: '/a' })).toBe(
      false,
    );
    expect(reporter.captureError(new Error('same'), { route: '/b' })).toBe(
      true,
    );
    expect(reporter.captureError(new Error('other'))).toBe(true);
  });

  it('re-accepts a deduplicated signature after the window elapses', () => {
    let clock = 0;
    const fetchMock: FetchMock = jest.fn().mockResolvedValue(okResponse());
    const reporter = new TelemetryReporter({
      endpoint: 'https://telemetry.example.com/errors',
      fetchImpl: fetchMock,
      dedupeWindowMs: 1_000,
      now: () => clock,
    });

    expect(reporter.captureError(new Error('same'))).toBe(true);
    expect(reporter.captureError(new Error('same'))).toBe(false);

    clock = 1_001;

    expect(reporter.captureError(new Error('same'))).toBe(true);
  });
});
