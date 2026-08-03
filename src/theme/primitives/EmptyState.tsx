import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/hooks';
import { ThemedText } from '@/theme/primitives/ThemedText';

export interface EmptyStateProps {
  actionLabel?: string;
  description?: string;
  icon?: ReactNode;
  onAction?: () => void;
  title: string;
}

export function EmptyState({
  actionLabel,
  description,
  icon,
  onAction,
  title,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      {icon ? (
        <View
          style={[
            styles.iconShell,
            {
              backgroundColor: theme.surface.glass.tint,
              borderColor: theme.surface.glass.border,
            },
          ]}
        >
          {icon}
        </View>
      ) : null}

      <ThemedText style={styles.title} variant="subtitle">
        {title}
      </ThemedText>

      {description ? (
        <ThemedText
          colorToken="secondary"
          style={styles.description}
          variant="bodySmall"
        >
          {description}
        </ThemedText>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.surface.glass.soft,
              borderColor: theme.surface.glass.border,
              borderRadius: theme.radius.pill,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <ThemedText colorToken="accent" variant="label">
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  iconShell: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  action: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 40,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});
