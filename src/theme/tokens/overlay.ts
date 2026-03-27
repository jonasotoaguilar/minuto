export const OVERLAY_TOKENS = {
  light: {
    scrim: 'rgba(11, 31, 20, 0.24)',
    modal: 'rgba(11, 31, 20, 0.42)',
  },
  dark: {
    scrim: 'rgba(0, 0, 0, 0.44)',
    modal: 'rgba(0, 0, 0, 0.62)',
  },
} as const;

export type ThemeOverlay = (typeof OVERLAY_TOKENS)[keyof typeof OVERLAY_TOKENS];
