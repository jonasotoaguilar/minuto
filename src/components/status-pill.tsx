import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatusPillProps = {
  label: string;
};

export function StatusPill({ label }: StatusPillProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.primary,
          backgroundColor: theme.primaryMuted,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.primary }]} />
      <Text style={[styles.text, { color: theme.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.sans,
    letterSpacing: 0.4,
  },
});
