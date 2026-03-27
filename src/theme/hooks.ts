import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  resolveTheme,
  resolveThemeMode,
  useThemeContext,
} from '@/theme/provider';

export function useTheme() {
  const scheme = useColorScheme();
  const context = useThemeContext();

  if (context) {
    return context.theme;
  }

  return resolveTheme(resolveThemeMode(scheme));
}
