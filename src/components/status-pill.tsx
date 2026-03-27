import { StyleSheet, Text, View } from 'react-native';

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
          gap: theme.spacing.xs,
          borderColor: theme.colors.brand.primary,
          backgroundColor: theme.colors.brand.muted,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <View
        style={[styles.dot, { backgroundColor: theme.colors.brand.primary }]}
      />
      <Text
        style={[
          styles.text,
          {
            color: theme.colors.brand.accent,
            fontFamily: theme.typography.label.fontFamily,
            fontSize: theme.typography.caption.fontSize,
            fontWeight: theme.typography.label.fontWeight,
            letterSpacing: 0.4,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {},
});
