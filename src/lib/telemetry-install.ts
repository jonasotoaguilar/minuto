import { Platform } from 'react-native';

import { telemetry } from '@/lib/telemetry';

type ErrorHandlerCallback = (error: unknown, isFatal?: boolean) => void;

interface GlobalErrorUtils {
  setGlobalHandler: (callback: ErrorHandlerCallback) => void;
  getGlobalHandler?: () => ErrorHandlerCallback;
}

function onWindowError(event: ErrorEvent): void {
  telemetry.captureError(event.error ?? event.message, {
    operation: 'uncaught',
    metadata: { fatal: true },
  });
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  telemetry.captureError(event.reason, {
    operation: 'unhandledRejection',
    metadata: { fatal: false },
  });
}

let nativeInstalledHandler: ErrorHandlerCallback | null = null;

/**
 * Installs global forwarding of uncaught errors and unhandled rejections into
 * the reporter. Idempotent on both platforms (addEventListener dedupes by
 * listener; the native handler is only replaced once and chained, preserving
 * the previous handler such as LogBox in dev). Web wiring is included so the
 * web layout owner can call the same API; until then web uncaught errors are
 * not forwarded (documented degradation).
 */
export function installUncaughtErrorReporting(
  platform: typeof Platform.OS = Platform.OS,
): boolean {
  if (platform === 'web') {
    if (typeof window === 'undefined' || !window.addEventListener) {
      return false;
    }

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return true;
  }

  const utils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;

  if (!utils || typeof utils.setGlobalHandler !== 'function') {
    return false;
  }

  if (
    nativeInstalledHandler !== null &&
    utils.getGlobalHandler?.() === nativeInstalledHandler
  ) {
    return false;
  }

  const previousHandler = utils.getGlobalHandler
    ? utils.getGlobalHandler()
    : () => undefined;

  const installedHandler: ErrorHandlerCallback = (error, isFatal) => {
    try {
      previousHandler(error, isFatal);
    } catch {
      // Never mask the app's own error handling.
    }

    telemetry.captureError(error, {
      operation: 'uncaught',
      metadata: { fatal: Boolean(isFatal) },
    });
  };

  utils.setGlobalHandler(installedHandler);
  nativeInstalledHandler = installedHandler;

  return true;
}
