export const REDACTED_PLACEHOLDER = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|token|secret|api[-_]?key|authorization|cookie|credential|jwt|private[-_]?key)/i;

const CREDENTIAL_URL_PATTERN = /(\bhttps?:\/\/)[^/@\s]+@/gi;

const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;

export function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return null;
}

export function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively redacts values that could carry credentials, tokens or PII:
 * values under sensitive keys are replaced wholesale, and known credential
 * patterns inside strings (Bearer/Basic headers, user:password in URLs) are
 * masked. Used only for free-form metadata; structured telemetry fields are
 * allowlisted at the call site and never pass through here.
 */
export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(BEARER_PATTERN, '$1 [REDACTED]')
      .replace(CREDENTIAL_URL_PATTERN, '$1[REDACTED]@');
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (isPlainRecord(value)) {
    return redactRecord(value);
  }

  return value;
}

export function redactRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = REDACTED_PLACEHOLDER;
    } else {
      redacted[key] = redactValue(value);
    }
  }

  return redacted;
}

export interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
}

const DEFAULT_MESSAGE_MAX_LENGTH = 500;
const DEFAULT_STACK_MAX_LENGTH = 2_000;

/**
 * Extracts a bounded, structured description of an unknown thrown value.
 * Message and stack are truncated so payloads stay small and free of
 * arbitrary user-controlled blobs.
 */
export function normalizeError(
  error: unknown,
  messageMaxLength = DEFAULT_MESSAGE_MAX_LENGTH,
  stackMaxLength = DEFAULT_STACK_MAX_LENGTH,
): NormalizedError {
  if (error instanceof Error) {
    return {
      name: truncateString(error.name || 'Error', messageMaxLength),
      message: truncateString(error.message || '', messageMaxLength),
      stack:
        typeof error.stack === 'string'
          ? truncateString(error.stack, stackMaxLength)
          : undefined,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: truncateString(error, messageMaxLength),
    };
  }

  const message = getErrorMessage(error);

  return {
    name: 'UnknownError',
    message: truncateString(message ?? 'Unknown error', messageMaxLength),
  };
}
