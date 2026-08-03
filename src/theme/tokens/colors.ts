const LIGHT_COLORS = {
  text: {
    primary: '#0B1F14',
    secondary: '#51665B',
    muted: '#5E7367',
    inverse: '#F5F7F6',
  },
  background: {
    screen: '#ECF8F1',
    card: '#FFFFFF',
    elevated: '#F5FBF7',
    selected: '#DFF2E8',
    muted: '#F5FBF7',
  },
  border: {
    default: '#D2E5D9',
    subtle: 'rgba(11, 31, 20, 0.08)',
    strong: '#A8C5B4',
  },
  brand: {
    primary: '#047857',
    accent: '#0B775A',
    muted: '#DFF6EB',
  },
  status: {
    success: '#11B981',
    warning: '#D97706',
    error: '#D14343',
  },
  shadow: {
    color: '#0B1F14',
  },
} as const;

const DARK_COLORS = {
  text: {
    primary: '#F5F7F6',
    secondary: '#B8C4BC',
    muted: '#8EA197',
    inverse: '#0B1F14',
  },
  background: {
    screen: '#0F1612',
    card: '#18211C',
    elevated: '#151E19',
    selected: '#1F2B24',
    muted: '#151E19',
  },
  border: {
    default: '#223028',
    subtle: 'rgba(245, 247, 246, 0.08)',
    strong: '#31443B',
  },
  brand: {
    primary: '#12C187',
    accent: '#0FA579',
    muted: '#1B2C23',
  },
  status: {
    success: '#12C187',
    warning: '#F59E0B',
    error: '#F06B6B',
  },
  shadow: {
    color: '#000000',
  },
} as const;

export const THEME_COLORS = {
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
} as const;

export type ThemeMode = keyof typeof THEME_COLORS;
export type ThemeColors = (typeof THEME_COLORS)[ThemeMode];
