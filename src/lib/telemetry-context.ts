let ambientRoute: string | undefined;

/** Route-like segments are pure letters with optional dashes; anything else
 * (ids, codes, numbers) becomes a generic param placeholder. */
const ROUTE_SEGMENT_PATTERN = /^[a-z-]+$/i;

/**
 * Normalizes a resolved pathname into a low-cardinality route template:
 * "/invite/abc123" -> "/invite/[param]". Returns undefined for values that
 * are not path-like. Query strings and ids never reach the payload.
 */
export function normalizeRouteForTelemetry(
  pathname: string,
): string | undefined {
  const trimmed = pathname.trim();

  if (!trimmed.startsWith('/')) {
    return undefined;
  }

  const segments = trimmed
    .split(/[?#]/, 1)[0]
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      ROUTE_SEGMENT_PATTERN.test(segment) ? segment : '[param]',
    );

  return `/${segments.join('/')}`;
}

/**
 * Ambient route for events captured without an explicit route (uncaught
 * errors). Sourced by the root layout; normalized to a route template, so it
 * never holds query params or ids.
 */
export function setRouteContext(route: string | undefined): void {
  ambientRoute = route ? normalizeRouteForTelemetry(route) : undefined;
}

export function getRouteContext(): string | undefined {
  return ambientRoute;
}
