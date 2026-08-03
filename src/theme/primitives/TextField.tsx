import { useId, useState } from 'react';
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
  /**
   * Overrides the error/helper text association. Defaults to the generated
   * id of the supporting text, which renders as `aria-describedby` on web.
   */
  accessibilityDescribedBy?: string;
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
  const inputId = useId().replace(/:/g, '');
  const effectiveInputId = props.nativeID ?? inputId;
  const labelId = `${effectiveInputId}-label`;
  const supportId = `${effectiveInputId}-support`;
  const supportingText = errorMessage ?? helperText;
  const supportingColorToken = errorMessage ? 'error' : 'secondary';
  const borderColor = errorMessage
    ? theme.colors.status.error
    : isFocused
      ? theme.colors.brand.primary
      : theme.colors.border.default;

  return (
    <View style={[styles.wrapper, { gap: theme.spacing.sm }, containerStyle]}>
      {label ? (
        <ThemedText nativeID={labelId} variant="label">
          {label}
        </ThemedText>
      ) : null}
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
          {...(supportingText && !props.accessibilityDescribedBy
            ? { accessibilityDescribedBy: supportId }
            : {})}
          {...(!props.nativeID ? { nativeID: inputId } : {})}
          {...(label &&
          !props.accessibilityLabelledBy &&
          !props.accessibilityLabel &&
          !props['aria-labelledby']
            ? { accessibilityLabelledBy: [labelId] }
            : {})}
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
        <ThemedText
          accessibilityLiveRegion="polite"
          accessibilityRole={errorMessage ? 'alert' : undefined}
          colorToken={supportingColorToken}
          nativeID={supportId}
          variant="caption"
        >
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
