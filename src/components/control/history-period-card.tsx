import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { GlassCard, ThemedText } from '@/theme/primitives';

export interface HistoryPeriodCardProps {
  errorMessage: string;
  nextDisabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  periodLabel: string;
  previousDisabled: boolean;
}

export function HistoryPeriodCard({
  errorMessage,
  nextDisabled,
  onNext,
  onPrevious,
  periodLabel,
  previousDisabled,
}: HistoryPeriodCardProps) {
  return (
    <GlassCard style={styles.periodCard} variant="soft">
      <View style={styles.monthNavigationRow}>
        <MonthArrowButton
          accessibilityLabel="Mes anterior"
          direction="previous"
          disabled={previousDisabled}
          onPress={onPrevious}
        />

        <View style={styles.monthLabelContainer}>
          <ThemedText selectable style={styles.monthLabel} variant="heading">
            {periodLabel}
          </ThemedText>
        </View>

        <MonthArrowButton
          accessibilityLabel="Mes siguiente"
          direction="next"
          disabled={nextDisabled}
          onPress={onNext}
        />
      </View>

      {errorMessage ? (
        <ThemedText colorToken="error" variant="bodySmall">
          {errorMessage}
        </ThemedText>
      ) : null}
    </GlassCard>
  );
}

type MonthArrowButtonProps = {
  accessibilityLabel: string;
  direction: 'previous' | 'next';
  disabled: boolean;
  onPress: () => void;
};

function MonthArrowButton({
  accessibilityLabel,
  direction,
  disabled,
  onPress,
}: MonthArrowButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monthArrowButton,
        {
          backgroundColor: theme.surface.glass.soft,
          borderColor: theme.surface.glass.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <ThemedText style={styles.monthArrowLabel} variant="heading">
        {direction === 'previous' ? '‹' : '›'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  periodCard: {
    gap: 16,
  },
  monthNavigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  monthLabelContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  monthLabel: {
    textTransform: 'capitalize',
  },
  monthArrowButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monthArrowLabel: {
    lineHeight: 24,
  },
});
