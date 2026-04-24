import { type Href } from 'expo-router';

const AUTH_PATHS = {
  LOGIN: '/login',
  REGISTER: '/register',
  AUTH_LOGIN: '/(auth)/login',
  AUTH_REGISTER: '/(auth)/register',
} as const;

type AuthPath = (typeof AUTH_PATHS)[keyof typeof AUTH_PATHS];

const AUTH_REDIRECT_BLOCKLIST = new Set<string>(Object.values(AUTH_PATHS));

export function sanitizeAuthRedirect(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    !trimmedValue.startsWith('/') ||
    trimmedValue.startsWith('//')
  ) {
    return null;
  }

  const [pathname] = trimmedValue.split(/[?#]/, 1);

  if (AUTH_REDIRECT_BLOCKLIST.has(pathname)) {
    return null;
  }

  return trimmedValue;
}

export function buildAuthRouteWithRedirect(
  pathname: AuthPath,
  redirectTo: unknown,
): Href {
  const sanitizedRedirect = sanitizeAuthRedirect(redirectTo);

  if (!sanitizedRedirect) {
    return pathname;
  }

  return {
    pathname,
    params: { redirect: sanitizedRedirect },
  } satisfies Href;
}
