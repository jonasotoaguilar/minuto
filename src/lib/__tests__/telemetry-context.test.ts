import {
  getRouteContext,
  normalizeRouteForTelemetry,
  setRouteContext,
} from '@/lib/telemetry-context';

describe('normalizeRouteForTelemetry', () => {
  it('keeps route-like segments and masks ids, codes and numbers', () => {
    expect(normalizeRouteForTelemetry('/control')).toBe('/control');
    expect(normalizeRouteForTelemetry('/edit-profile')).toBe('/edit-profile');
    expect(normalizeRouteForTelemetry('/invite/abc123')).toBe(
      '/invite/[param]',
    );
    expect(normalizeRouteForTelemetry('/team/550e8400-e29b-41d4')).toBe(
      '/team/[param]',
    );
  });

  it('strips query strings and rejects non-path values', () => {
    expect(normalizeRouteForTelemetry('/control?tab=history')).toBe('/control');
    expect(normalizeRouteForTelemetry('not-a-path')).toBeUndefined();
    expect(normalizeRouteForTelemetry('')).toBeUndefined();
    expect(normalizeRouteForTelemetry('   ')).toBeUndefined();
  });
});

describe('route context', () => {
  afterEach(() => {
    setRouteContext(undefined);
  });

  it('stores a normalized route and clears it', () => {
    expect(getRouteContext()).toBeUndefined();

    setRouteContext('/invite/abc123');
    expect(getRouteContext()).toBe('/invite/[param]');

    setRouteContext(undefined);
    expect(getRouteContext()).toBeUndefined();
  });
});
