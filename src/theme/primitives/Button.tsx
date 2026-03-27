import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/hooks';
import { ThemedText } from '@/theme/primitives/ThemedText';

const BUTTON_VARIANTS = {
  primary: 'primary',
  secondary: 'secondary',
} as const;

type NativePressableProps = ComponentProps<typeof Pressable>;

interface ButtonBaseProps
  extends Omit<NativePressableProps, 'children' | 'style'> {
  fullWidth?: boolean;
  label: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

interface ButtonRootProps extends ButtonBaseProps {
  variant: (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];
}

function ButtonRoot({
  disabled,
  fullWidth = true,
  label,
  loading = false,
  style,
  textStyle,
  variant,
  ...props
}: ButtonRootProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const isPrimary = variant === BUTTON_VARIANTS.primary;

  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        fullWidth ? styles.fullWidth : null,
        {
          backgroundColor: isPrimary
            ? theme.colors.brand.primary
            : pressed
              ? theme.colors.background.selected
              : theme.colors.background.card,
          borderColor: isPrimary
            ? theme.colors.brand.primary
            : pressed
              ? theme.colors.border.strong
              : theme.colors.border.default,
          opacity: isDisabled ? 0.6 : pressed ? 0.92 : 1,
        },
        {
          borderRadius: theme.radius.pill,
          gap: theme.spacing.sm,
          minHeight:
            theme.spacing['2xl'] + theme.spacing['2xl'] + theme.spacing.xs,
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            isPrimary ? theme.colors.text.inverse : theme.colors.brand.accent
          }
          size="small"
        />
      ) : (
        <ThemedText
          colorToken={isPrimary ? 'inverse' : 'accent'}
          style={textStyle}
          variant="label"
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export interface PrimaryButtonProps extends ButtonBaseProps {}

export function PrimaryButton(props: PrimaryButtonProps) {
  return <ButtonRoot {...props} variant={BUTTON_VARIANTS.primary} />;
}

export interface SecondaryButtonProps extends ButtonBaseProps {}

export function SecondaryButton(props: SecondaryButtonProps) {
  return <ButtonRoot {...props} variant={BUTTON_VARIANTS.secondary} />;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
});
