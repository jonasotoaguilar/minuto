import { z } from 'zod';

export const PROFILE_UPDATE_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type ProfileUpdateStatus =
  (typeof PROFILE_UPDATE_STATUS)[keyof typeof PROFILE_UPDATE_STATUS];

export type ProfileUpdateFeedback = {
  message: string;
  status: ProfileUpdateStatus;
};

const PROFILE_UPDATE_MESSAGE_MAX_LENGTH = 160;

const profileUpdateFeedbackRouteSchema = z.object({
  message: z.string().trim().min(1).max(PROFILE_UPDATE_MESSAGE_MAX_LENGTH),
  status: z.enum([PROFILE_UPDATE_STATUS.SUCCESS, PROFILE_UPDATE_STATUS.ERROR]),
});

export function parseProfileUpdateFeedbackRouteParams(input: {
  message?: string | string[];
  status?: string | string[];
}): ProfileUpdateFeedback | null {
  const message = typeof input.message === 'string' ? input.message : '';
  const status = typeof input.status === 'string' ? input.status : '';

  const result = profileUpdateFeedbackRouteSchema.safeParse({
    message,
    status,
  });

  return result.success ? result.data : null;
}
