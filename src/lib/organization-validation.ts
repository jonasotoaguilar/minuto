import { z } from 'zod';

const DEFAULT_TIMEZONE = 'America/Santiago';

function isValidTimezone(value: string) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const createOrganizationInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar los 120 caracteres.')
    .regex(/^[^<>]+$/, 'El nombre contiene caracteres inválidos.'),
  location: z
    .string()
    .trim()
    .min(3, 'La ubicación debe tener al menos 3 caracteres.')
    .max(180, 'La ubicación no puede superar los 180 caracteres.')
    .regex(/^[^<>]+$/, 'La ubicación contiene caracteres inválidos.'),
  timezone: z
    .string()
    .trim()
    .min(1, 'La zona horaria es obligatoria.')
    .refine(isValidTimezone, 'La zona horaria no es válida.'),
});

export type CreateOrganizationInput = z.infer<
  typeof createOrganizationInputSchema
>;

export function getDefaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
}

export function getFirstValidationError(
  errors: Record<string, string[] | undefined>,
) {
  const firstFieldWithError = Object.values(errors).find(
    (fieldErrors) => fieldErrors && fieldErrors.length > 0,
  );

  return firstFieldWithError?.[0] ?? '';
}
