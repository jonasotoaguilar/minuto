import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SecondaryButton, ThemedText } from '@/theme/primitives';

type SecondaryScreenHeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
};

export function SecondaryScreenHeader({
  title,
  subtitle,
  onBack,
}: SecondaryScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.wrapper, { gap: theme.spacing.lg }]}>
      <View style={[styles.topRow, { gap: theme.spacing.sm }]}>
        <ThemedText
          colorToken="accent"
          style={styles.brandText}
          variant="eyebrow"
        >
          Minuto
        </ThemedText>

        <SecondaryButton
          accessibilityLabel="Volver a la pantalla anterior"
          fullWidth={false}
          label="Volver"
          onPress={onBack}
          style={styles.backButton}
          textStyle={styles.backButtonText}
        />
      </View>

      <View style={[styles.copyBlock, { gap: theme.spacing.xs }]}>
        <ThemedText style={styles.title} variant="heading">
          {title}
        </ThemedText>
        <ThemedText
          colorToken="secondary"
          style={styles.subtitle}
          variant="bodySmall"
        >
          {subtitle}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandText: {
    textTransform: 'uppercase',
  },
  backButton: {
    minHeight: 44,
  },
  backButtonText: {
    textTransform: 'uppercase',
  },
  copyBlock: {},
  title: {},
  subtitle: {},
});
