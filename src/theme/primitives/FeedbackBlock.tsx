import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/hooks';
import {
  ThemedText,
  type ThemedTextColorToken,
} from '@/theme/primitives/ThemedText';

const FEEDBACK_TONES = {
  error: 'error',
  info: 'info',
  success: 'success',
  warning: 'warning',
} as const;

export type FeedbackTone = (typeof FEEDBACK_TONES)[keyof typeof FEEDBACK_TONES];

export interface FeedbackBlockProps {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  tone: FeedbackTone;
  title?: string;
}

function resolveFeedbackColors(
  theme: ReturnType<typeof useTheme>,
  tone: FeedbackTone,
) {
  switch (tone) {
    case FEEDBACK_TONES.error:
      return {
        backgroundColor: theme.surface.danger,
        borderColor: theme.surface.glass.border,
        textColorToken: 'error' as ThemedTextColorToken,
      };
    case FEEDBACK_TONES.warning:
      return {
        backgroundColor: theme.surface.glass.soft,
        borderColor: theme.colors.status.warning,
        textColorToken: 'warning' as ThemedTextColorToken,
      };
    case FEEDBACK_TONES.success:
      return {
        backgroundColor: theme.colors.brand.muted,
        borderColor: theme.colors.border.default,
        textColorToken: 'success' as ThemedTextColorToken,
      };
    case FEEDBACK_TONES.info:
    default:
      return {
        backgroundColor: theme.surface.glass.soft,
        borderColor: theme.surface.glass.border,
        textColorToken: 'secondary' as ThemedTextColorToken,
      };
  }
}

export function FeedbackBlock({
  actionLabel,
  message,
  onAction,
  style,
  tone,
  title,
}: FeedbackBlockProps) {
  const theme = useTheme();
  const colors = resolveFeedbackColors(theme, tone);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderRadius: theme.radius.lg,
        },
        style,
      ]}
    >
      {title ? (
        <ThemedText colorToken={colors.textColorToken} variant="subtitle">
          {title}
        </ThemedText>
      ) : null}

      <ThemedText colorToken={colors.textColorToken} variant="bodySmall">
        {message}
      </ThemedText>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            {
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
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  action: {
    alignSelf: 'flex-start',
  },
});
