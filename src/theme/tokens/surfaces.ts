const SURFACE_TOKENS = {
  light: {
    canvas: '#ECF8F1',
    card: '#FFFFFF',
    elevated: '#F5FBF7',
    selected: '#DFF2E8',
    glass: {
      strong: 'rgba(255, 255, 255, 0.70)',
      soft: 'rgba(255, 255, 255, 0.40)',
      tint: 'rgba(236, 248, 241, 0.72)',
      border: 'rgba(255, 255, 255, 0.00)',
      glow: 'rgba(16, 183, 127, 0.24)',
      blur: 18,
    },
    hairline: 'rgba(255, 255, 255, 0.30)',
    danger: 'rgba(209, 67, 67, 0.12)',
  },
  dark: {
    canvas: '#0F1612',
    card: '#18211C',
    elevated: '#151E19',
    selected: '#1F2B24',
    glass: {
      strong: 'rgba(24, 33, 28, 0.82)',
      soft: 'rgba(24, 33, 28, 0.64)',
      tint: 'rgba(15, 22, 18, 0.76)',
      border: 'rgba(255, 255, 255, 0.00)',
      glow: 'rgba(18, 193, 135, 0.28)',
      blur: 20,
    },
    hairline: 'rgba(255, 255, 255, 0.12)',
    danger: 'rgba(240, 107, 107, 0.16)',
  },
} as const;

export const THEME_SURFACES = SURFACE_TOKENS;

export type ThemeSurfaces =
  (typeof THEME_SURFACES)[keyof typeof THEME_SURFACES];
