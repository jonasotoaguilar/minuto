import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/hooks';

const GLASS_CARD_VARIANTS = {
  strong: 'strong',
  soft: 'soft',
  tint: 'tint',
} as const;

export type GlassCardVariant =
  (typeof GLASS_CARD_VARIANTS)[keyof typeof GLASS_CARD_VARIANTS];

export interface GlassCardProps extends PropsWithChildren<ViewProps> {
  padding?: number;
  style?: StyleProp<ViewStyle>;
  variant?: GlassCardVariant;
}

export interface PlainCardProps extends PropsWithChildren<ViewProps> {
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

export function GlassCard({
  children,
  padding,
  style,
  variant = GLASS_CARD_VARIANTS.strong,
  ...props
}: GlassCardProps) {
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface.glass[variant],
          borderRadius: theme.radius.xl,
          padding: padding ?? theme.spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PlainCard({
  children,
  padding,
  style,
  ...props
}: PlainCardProps) {
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.background.card,
          borderColor: theme.colors.border.default,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          padding: padding ?? theme.spacing.lg,
          shadowColor: theme.colors.shadow.color,
          ...theme.elevation.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
