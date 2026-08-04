type TelemetryInstallModule = typeof import('@/lib/telemetry-install');
type ErrorHandlerCallback = (error: unknown, isFatal?: boolean) => void;

const originalErrorUtils = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;

function loadFreshModule(): TelemetryInstallModule {
  jest.resetModules();
  return require('@/lib/telemetry-install') as TelemetryInstallModule;
}

describe('installUncaughtErrorReporting', () => {
  afterEach(() => {
    if (originalErrorUtils === undefined) {
      delete (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
    } else {
      Object.defineProperty(globalThis, 'ErrorUtils', {
        configurable: true,
        value: originalErrorUtils,
      });
    }
  });

  it('chains the previous native handler and forwards uncaught errors', () => {
    const previousHandler = jest.fn<ErrorHandlerCallback, []>();
    let currentHandler: ErrorHandlerCallback | null = null;
    let setCalls = 0;

    Object.defineProperty(globalThis, 'ErrorUtils', {
      configurable: true,
      value: {
        getGlobalHandler: () => currentHandler ?? previousHandler,
        setGlobalHandler: (handler: ErrorHandlerCallback) => {
          setCalls += 1;
          currentHandler = handler;
        },
      },
    });

    const module = loadFreshModule();
    const telemetryModule =
      require('@/lib/telemetry') as typeof import('@/lib/telemetry');
    const captureError = jest.spyOn(telemetryModule.telemetry, 'captureError');

    expect(module.installUncaughtErrorReporting()).toBe(true);

    const error = new Error('boom');
    currentHandler!(error, false);

    expect(previousHandler).toHaveBeenCalledWith(error, false);
    expect(captureError).toHaveBeenCalledWith(error, {
      operation: 'uncaught',
      metadata: { fatal: false },
    });

    expect(module.installUncaughtErrorReporting()).toBe(false);
    expect(setCalls).toBe(1);
  });

  it('does not re-wrap the handler once installed', () => {
    let setCalls = 0;
    let currentHandler: ErrorHandlerCallback | null = null;

    Object.defineProperty(globalThis, 'ErrorUtils', {
      configurable: true,
      value: {
        getGlobalHandler: () => currentHandler,
        setGlobalHandler: (handler: ErrorHandlerCallback) => {
          setCalls += 1;
          currentHandler = handler;
        },
      },
    });

    const module = loadFreshModule();

    expect(module.installUncaughtErrorReporting()).toBe(true);
    expect(module.installUncaughtErrorReporting()).toBe(false);
    expect(setCalls).toBe(1);
  });

  it('returns false when ErrorUtils is unavailable', () => {
    delete (globalThis as { ErrorUtils?: unknown }).ErrorUtils;

    const module = loadFreshModule();

    expect(module.installUncaughtErrorReporting()).toBe(false);
  });

  it('installs web window listeners when run on web', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const addEventListener = jest.fn(
      (type: string, listener: (event: unknown) => void) => {
        if (!listeners.has(type)) {
          listeners.set(type, listener);
        }
      },
    );

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { addEventListener },
    });

    try {
      const module = loadFreshModule();
      const telemetryModule =
        require('@/lib/telemetry') as typeof import('@/lib/telemetry');
      const captureError = jest.spyOn(
        telemetryModule.telemetry,
        'captureError',
      );

      expect(module.installUncaughtErrorReporting('web')).toBe(true);

      const error = new Error('web boom');
      listeners.get('error')?.({ error, message: 'web boom' });
      listeners.get('unhandledrejection')?.({ reason: 'rejected' });

      expect(captureError).toHaveBeenCalledWith(error, {
        operation: 'uncaught',
        metadata: { fatal: true },
      });
      expect(captureError).toHaveBeenCalledWith('rejected', {
        operation: 'unhandledRejection',
        metadata: { fatal: false },
      });

      expect(module.installUncaughtErrorReporting('web')).toBe(true);
      expect([...listeners.keys()]).toEqual(['error', 'unhandledrejection']);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it('returns false on web when window listeners are unavailable', () => {
    const module = loadFreshModule();

    expect(module.installUncaughtErrorReporting('web')).toBe(false);
  });
});
