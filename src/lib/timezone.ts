export const DEFAULT_TIMEZONE = 'America/Santiago';

export function isValidTimezone(
  value: string | null | undefined,
): value is string {
  if (!value || value.trim().length === 0) {
    return false;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn(`Invalid timezone value: "${value}"`, error);
    }
    return false;
  }
}

export function getRuntimeTimezone(): string {
  const runtimeTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (isValidTimezone(runtimeTimezone)) {
    return runtimeTimezone;
  }

  return DEFAULT_TIMEZONE;
}

export function resolveOrganizationTimezone(
  organizationTimezone: string | null | undefined,
): string {
  if (isValidTimezone(organizationTimezone)) {
    return organizationTimezone;
  }

  return getRuntimeTimezone();
}
