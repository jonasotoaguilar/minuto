import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { THEME_COLORS, type ThemeMode } from '@/theme/tokens/colors';
import { ELEVATION_TOKENS } from '@/theme/tokens/elevation';
import { OVERLAY_TOKENS } from '@/theme/tokens/overlay';
import { RADIUS_SCALE } from '@/theme/tokens/radius';
import { SPACING_SCALE } from '@/theme/tokens/spacing';
import { THEME_SURFACES } from '@/theme/tokens/surfaces';
import { TYPOGRAPHY_TOKENS } from '@/theme/tokens/typography';
import type { AppTheme, AppThemeContextValue } from '@/theme/types';

const ThemeContext = createContext<AppThemeContextValue | null>(null);

export function resolveThemeMode(
  colorScheme: string | null | undefined,
): ThemeMode {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): AppTheme {
  const colors = THEME_COLORS[mode];
  const surface = THEME_SURFACES[mode];
  const overlay = OVERLAY_TOKENS[mode];

  return {
    mode,
    isDark: mode === 'dark',
    colors,
    surface,
    surfaces: surface,
    overlay,
    spacing: SPACING_SCALE,
    radius: RADIUS_SCALE,
    elevation: ELEVATION_TOKENS,
    typography: TYPOGRAPHY_TOKENS,
  };
}

export function createNavigationTheme(theme: AppTheme) {
  const baseTheme = theme.isDark ? NavigationDarkTheme : NavigationDefaultTheme;

  return {
    ...baseTheme,
    dark: theme.isDark,
    colors: {
      ...baseTheme.colors,
      primary: theme.colors.brand.primary,
      background: theme.colors.background.screen,
      card: theme.colors.background.card,
      text: theme.colors.text.primary,
      border: theme.colors.border.default,
      notification: theme.colors.brand.accent,
    },
  };
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const mode = resolveThemeMode(colorScheme);

  const value = useMemo<AppThemeContextValue>(() => {
    const theme = resolveTheme(mode);
    const navigationTheme = createNavigationTheme(theme);

    return {
      theme,
      navigationTheme,
    };
  }, [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={value.navigationTheme}>
        {children}
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
