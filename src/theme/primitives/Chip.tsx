import type { ComponentProps } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/hooks';
import { ThemedText } from '@/theme/primitives/ThemedText';

const CHIP_TONES = {
  neutral: 'neutral',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

type NativePressableProps = ComponentProps<typeof Pressable>;

export type ChipTone = (typeof CHIP_TONES)[keyof typeof CHIP_TONES];

export interface ChipProps
  extends Omit<NativePressableProps, 'children' | 'style'> {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: ChipTone;
}

function resolveChipColors(
  theme: ReturnType<typeof useTheme>,
  tone: ChipTone,
  selected: boolean,
) {
  if (selected) {
    switch (tone) {
      case CHIP_TONES.brand:
        return {
          backgroundColor: theme.colors.brand.primary,
          borderColor: theme.colors.brand.primary,
          textColorToken: 'inverse' as const,
        };
      case CHIP_TONES.success:
        return {
          backgroundColor: theme.colors.status.success,
          borderColor: theme.colors.status.success,
          textColorToken: 'inverse' as const,
        };
      case CHIP_TONES.warning:
        return {
          backgroundColor: theme.colors.status.warning,
          borderColor: theme.colors.status.warning,
          textColorToken: 'inverse' as const,
        };
      case CHIP_TONES.danger:
        return {
          backgroundColor: theme.colors.status.error,
          borderColor: theme.colors.status.error,
          textColorToken: 'inverse' as const,
        };
      case CHIP_TONES.neutral:
      default:
        return {
          backgroundColor: theme.colors.background.selected,
          borderColor: theme.colors.border.default,
          textColorToken: 'primary' as const,
        };
    }
  }

  switch (tone) {
    case CHIP_TONES.brand:
      return {
        backgroundColor: theme.colors.brand.muted,
        borderColor: theme.colors.brand.muted,
        textColorToken: 'accent' as const,
      };
    case CHIP_TONES.success:
      return {
        backgroundColor: theme.surface.glass.soft,
        borderColor: theme.colors.status.success,
        textColorToken: 'success' as const,
      };
    case CHIP_TONES.warning:
      return {
        backgroundColor: theme.surface.glass.soft,
        borderColor: theme.colors.status.warning,
        textColorToken: 'warning' as const,
      };
    case CHIP_TONES.danger:
      return {
        backgroundColor: theme.surface.danger,
        borderColor: theme.colors.status.error,
        textColorToken: 'error' as const,
      };
    case CHIP_TONES.neutral:
    default:
      return {
        backgroundColor: theme.surface.glass.soft,
        borderColor: theme.surface.glass.border,
        textColorToken: 'secondary' as const,
      };
  }
}

export function Chip({
  disabled,
  label,
  onPress,
  selected = false,
  style,
  tone = CHIP_TONES.neutral,
  ...props
}: ChipProps) {
  const theme = useTheme();
  const colors = resolveChipColors(theme, tone, selected);
  const content = (
    <View
      style={[
        styles.chip,
        {
          borderRadius: theme.radius.pill,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          minHeight: theme.spacing.xl + theme.spacing.lg,
          paddingHorizontal: theme.spacing.md + theme.spacing.xs / 2,
          paddingVertical: theme.spacing.sm,
        },
        style,
      ]}
    >
      <ThemedText colorToken={colors.textColorToken} variant="label">
        {label}
      </ThemedText>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
