import { z } from 'zod';

import { DEFAULT_TIMEZONE, isValidTimezone } from '@/lib/timezone';

export interface CreateOrganizationOfficeInput {
  name: string;
  addressLabel?: string;
  latitude: number;
  longitude: number;
}

export interface CreateOrganizationInput {
  defaultTimezone: string;
  name: string;
  office?: CreateOrganizationOfficeInput | null;
  /** @deprecated Compat-only during org location rollout. */
  location?: string;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export const createOrganizationInputSchema = z.object({
  defaultTimezone: z
    .string()
    .trim()
    .min(1, 'La zona horaria de la organización es obligatoria.')
    .max(120, 'La zona horaria de la organización no es válida.')
    .refine((value) => isValidTimezone(value), {
      message: 'La zona horaria de la organización no es válida.',
    })
    .catch(DEFAULT_TIMEZONE),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar los 120 caracteres.')
    .regex(/^[^<>]+$/, 'El nombre contiene caracteres inválidos.'),
  location: z.preprocess(
    normalizeOptionalText,
    z
      .string()
      .min(3, 'La dirección debe tener al menos 3 caracteres.')
      .max(180, 'La dirección no puede superar los 180 caracteres.')
      .regex(/^[^<>]+$/, 'La dirección contiene caracteres inválidos.')
      .optional(),
  ),
  office: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, 'El nombre de la oficina debe tener al menos 2 caracteres.')
        .max(
          120,
          'El nombre de la oficina no puede superar los 120 caracteres.',
        )
        .regex(
          /^[^<>]+$/,
          'El nombre de la oficina contiene caracteres inválidos.',
        ),
      addressLabel: z.preprocess(
        normalizeOptionalText,
        z
          .string()
          .min(3, 'La referencia debe tener al menos 3 caracteres.')
          .max(180, 'La referencia no puede superar los 180 caracteres.')
          .regex(/^[^<>]+$/, 'La referencia contiene caracteres inválidos.')
          .optional(),
      ),
      latitude: z
        .number({ error: 'La latitud de la oficina es obligatoria.' })
        .finite('La latitud de la oficina no es válida.')
        .min(-90, 'La latitud de la oficina no es válida.')
        .max(90, 'La latitud de la oficina no es válida.'),
      longitude: z
        .number({ error: 'La longitud de la oficina es obligatoria.' })
        .finite('La longitud de la oficina no es válida.')
        .min(-180, 'La longitud de la oficina no es válida.')
        .max(180, 'La longitud de la oficina no es válida.'),
    })
    .strict()
    .nullable()
    .optional(),
}) satisfies z.ZodType<CreateOrganizationInput>;

export function getFirstValidationError(
  errors: Record<string, string[] | undefined>,
) {
  const firstFieldWithError = Object.values(errors).find(
    (fieldErrors) => fieldErrors && fieldErrors.length > 0,
  );

  return firstFieldWithError?.[0] ?? '';
}
