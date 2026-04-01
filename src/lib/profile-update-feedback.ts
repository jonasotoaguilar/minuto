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
