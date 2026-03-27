import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/hooks';
import { ThemedText } from '@/theme/primitives/ThemedText';

export interface SectionHeaderProps {
  action?: ReactNode;
  actionLabel?: string;
  actionProps?: Omit<PressableProps, 'children'>;
  eyebrow?: string;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
}

export function SectionHeader({
  action,
  actionLabel,
  actionProps,
  eyebrow,
  style,
  subtitle,
  title,
}: SectionHeaderProps) {
  const theme = useTheme();
  const actionNode =
    action ??
    (actionLabel ? (
      <Pressable
        accessibilityRole="button"
        {...actionProps}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: pressed
              ? theme.surface.glass.strong
              : theme.surface.glass.soft,
            borderColor: theme.surface.glass.border,
            borderRadius: theme.radius.pill,
            minHeight: theme.spacing.xl * 2,
            paddingHorizontal: theme.spacing.lg,
          },
        ]}
      >
        <ThemedText variant="label" colorToken="accent">
          {actionLabel}
        </ThemedText>
      </Pressable>
    ) : null);

  return (
    <View style={[styles.wrapper, { gap: theme.spacing.md }, style]}>
      <View style={[styles.copy, { gap: theme.spacing.xs }]}>
        {eyebrow ? (
          <ThemedText variant="eyebrow" colorToken="accent">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText variant="title">{title}</ThemedText>
        {subtitle ? (
          <ThemedText variant="bodySmall" colorToken="secondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {actionNode}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
  },
  action: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
});
