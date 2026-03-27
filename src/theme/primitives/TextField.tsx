import { useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/hooks';
import { ThemedText } from '@/theme/primitives/ThemedText';

export interface TextFieldProps
  extends Omit<TextInputProps, 'placeholderTextColor' | 'style'> {
  containerStyle?: StyleProp<ViewStyle>;
  errorMessage?: string;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
}

export function TextField({
  containerStyle,
  errorMessage,
  helperText,
  inputStyle,
  label,
  onBlur,
  onFocus,
  ...props
}: TextFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const supportingText = errorMessage ?? helperText;
  const supportingColorToken = errorMessage ? 'error' : 'secondary';
  const borderColor = errorMessage
    ? theme.colors.status.error
    : isFocused
      ? theme.colors.brand.primary
      : theme.colors.border.default;

  return (
    <View style={[styles.wrapper, { gap: theme.spacing.sm }, containerStyle]}>
      {label ? <ThemedText variant="label">{label}</ThemedText> : null}
      <View
        style={[
          styles.inputFrame,
          theme.elevation.card,
          {
            backgroundColor: theme.colors.background.card,
            borderColor,
            borderRadius: theme.radius.lg,
            minHeight: theme.spacing['4xl'] + theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            shadowColor: theme.colors.shadow.color,
          },
        ]}
      >
        <TextInput
          {...props}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.text.muted}
          selectionColor={theme.colors.brand.primary}
          style={[
            styles.input,
            theme.typography.body,
            {
              color: theme.colors.text.primary,
              minHeight:
                theme.spacing['4xl'] + theme.spacing.xs + theme.spacing.xs,
            },
            inputStyle,
          ]}
        />
      </View>
      {supportingText ? (
        <ThemedText colorToken={supportingColorToken} variant="caption">
          {supportingText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  inputFrame: {
    borderWidth: 1,
  },
  input: {
    flex: 1,
  },
});
