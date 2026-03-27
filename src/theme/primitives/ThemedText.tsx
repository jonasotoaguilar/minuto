import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/hooks';

const TEXT_VARIANTS = {
  display: 'display',
  heading: 'heading',
  title: 'title',
  subtitle: 'subtitle',
  body: 'body',
  bodySmall: 'bodySmall',
  caption: 'caption',
  label: 'label',
  eyebrow: 'eyebrow',
} as const;

const TEXT_COLOR_TOKENS = {
  primary: 'primary',
  secondary: 'secondary',
  muted: 'muted',
  inverse: 'inverse',
  brand: 'brand',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const;

type NativeTextProps = ComponentProps<typeof Text>;

export type ThemedTextVariant =
  (typeof TEXT_VARIANTS)[keyof typeof TEXT_VARIANTS];

export type ThemedTextColorToken =
  (typeof TEXT_COLOR_TOKENS)[keyof typeof TEXT_COLOR_TOKENS];

export interface ThemedTextProps extends NativeTextProps {
  colorToken?: ThemedTextColorToken;
  variant?: ThemedTextVariant;
}

function resolveTextColor(
  theme: ReturnType<typeof useTheme>,
  colorToken: ThemedTextColorToken,
) {
  switch (colorToken) {
    case TEXT_COLOR_TOKENS.secondary:
      return theme.colors.text.secondary;
    case TEXT_COLOR_TOKENS.muted:
      return theme.colors.text.muted;
    case TEXT_COLOR_TOKENS.inverse:
      return theme.colors.text.inverse;
    case TEXT_COLOR_TOKENS.brand:
      return theme.colors.brand.primary;
    case TEXT_COLOR_TOKENS.accent:
      return theme.colors.brand.accent;
    case TEXT_COLOR_TOKENS.success:
      return theme.colors.status.success;
    case TEXT_COLOR_TOKENS.warning:
      return theme.colors.status.warning;
    case TEXT_COLOR_TOKENS.error:
      return theme.colors.status.error;
    case TEXT_COLOR_TOKENS.primary:
    default:
      return theme.colors.text.primary;
  }
}

export function ThemedText({
  colorToken = TEXT_COLOR_TOKENS.primary,
  style,
  variant = TEXT_VARIANTS.body,
  ...props
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      {...props}
      style={[
        styles.base,
        theme.typography[variant],
        { color: resolveTextColor(theme, colorToken) },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
