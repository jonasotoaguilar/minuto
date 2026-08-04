import {
  getErrorMessage,
  isPlainRecord,
  normalizeError,
  REDACTED_PLACEHOLDER,
  redactRecord,
  redactValue,
  truncateString,
} from '@/lib/error';

describe('getErrorMessage', () => {
  it('returns the message for Error instances and string errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('raw failure')).toBe('raw failure');
    expect(getErrorMessage({ message: 'object failure' })).toBe(
      'object failure',
    );
  });

  it('returns null for non-errors and empty messages', () => {
    expect(getErrorMessage(null)).toBeNull();
    expect(getErrorMessage(undefined)).toBeNull();
    expect(getErrorMessage(42)).toBeNull();
    expect(getErrorMessage(new Error('  '))).toBeNull();
    expect(getErrorMessage({ code: 500 })).toBeNull();
  });
});

describe('truncateString', () => {
  it('truncates long strings and keeps short ones', () => {
    expect(truncateString('short', 10)).toBe('short');
    expect(truncateString('a'.repeat(100), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

describe('isPlainRecord', () => {
  it('accepts plain objects and rejects arrays, nulls and primitives', () => {
    expect(isPlainRecord({ a: 1 })).toBe(true);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(null)).toBe(false);
    expect(isPlainRecord('x')).toBe(false);
  });
});

describe('redactRecord', () => {
  it('replaces values under sensitive keys wholesale', () => {
    expect(
      redactRecord({
        password: 'hunter2',
        api_key: 'sk-123',
        userToken: 'ey.jwt',
        safe: 'kept',
      }),
    ).toEqual({
      password: REDACTED_PLACEHOLDER,
      api_key: REDACTED_PLACEHOLDER,
      userToken: REDACTED_PLACEHOLDER,
      safe: 'kept',
    });
  });

  it('masks bearer headers and credentials embedded in URLs', () => {
    expect(
      redactRecord({
        url: 'https://user:pass@api.example.com/v1',
        authHeader: 'Bearer abc.def.ghi',
      }),
    ).toEqual({
      url: 'https://[REDACTED]@api.example.com/v1',
      authHeader: 'Bearer [REDACTED]',
    });
  });

  it('redacts recursively through nested objects and arrays', () => {
    expect(
      redactRecord({
        nested: {
          authorization: 'Bearer xyz',
          list: [{ password: 'p', value: 'ok' }],
        },
      }),
    ).toEqual({
      nested: {
        authorization: REDACTED_PLACEHOLDER,
        list: [{ password: REDACTED_PLACEHOLDER, value: 'ok' }],
      },
    });
  });

  it('keeps numbers, booleans, nulls and safe strings unchanged', () => {
    const input = {
      count: 3,
      active: true,
      nothing: null,
      route: '/control',
    };

    expect(redactRecord(input)).toEqual(input);
  });
});

describe('redactValue', () => {
  it('passes non-string primitives through', () => {
    expect(redactValue(42)).toBe(42);
    expect(redactValue(null)).toBeNull();
    expect(redactValue(true)).toBe(true);
  });
});

describe('normalizeError', () => {
  it('extracts name, message and truncated stack from Error instances', () => {
    const error = new Error('boom');
    const normalized = normalizeError(error);

    expect(normalized.name).toBe('Error');
    expect(normalized.message).toBe('boom');
    expect(normalized.stack).toBeDefined();
  });

  it('truncates oversized messages and stacks', () => {
    const error = new Error('x'.repeat(1_000));
    const normalized = normalizeError(error, 50, 100);

    expect(normalized.message).toHaveLength(51);
    expect(normalized.message.endsWith('…')).toBe(true);
    expect((normalized.stack ?? '').length).toBeLessThanOrEqual(101);
  });

  it('handles strings, objects and unknown values', () => {
    expect(normalizeError('plain')).toEqual({
      name: 'Error',
      message: 'plain',
    });
    expect(normalizeError({ message: 'wrapped' }).message).toBe('wrapped');
    expect(normalizeError(42).message).toBe('Unknown error');
    expect(normalizeError(undefined).message).toBe('Unknown error');
  });
});
