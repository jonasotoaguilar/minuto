import type { Theme as NavigationTheme } from '@react-navigation/native';

import type { ThemeColors, ThemeMode } from '@/theme/tokens/colors';
import { ELEVATION_TOKENS } from '@/theme/tokens/elevation';
import type { ThemeOverlay } from '@/theme/tokens/overlay';
import { RADIUS_SCALE } from '@/theme/tokens/radius';
import { SPACING_SCALE } from '@/theme/tokens/spacing';
import type { ThemeSurfaces } from '@/theme/tokens/surfaces';
import type { TypographyTokens } from '@/theme/tokens/typography';

export type AppThemeSpacing = typeof SPACING_SCALE;
export type AppThemeRadius = typeof RADIUS_SCALE;
export type AppThemeElevation = typeof ELEVATION_TOKENS;

export type AppTheme = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  surface: ThemeSurfaces;
  surfaces: ThemeSurfaces;
  overlay: ThemeOverlay;
  spacing: AppThemeSpacing;
  radius: AppThemeRadius;
  elevation: AppThemeElevation;
  typography: TypographyTokens;
};

export type AppThemeContextValue = {
  navigationTheme: NavigationTheme;
  theme: AppTheme;
};
