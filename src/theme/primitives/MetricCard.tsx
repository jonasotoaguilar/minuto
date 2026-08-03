import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/theme/hooks';
import { GlassCard } from '@/theme/primitives/GlassCard';
import {
  ThemedText,
  type ThemedTextColorToken,
} from '@/theme/primitives/ThemedText';

export interface MetricCardProps {
  helper?: string;
  icon?: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
  value: string;
  valueToken?: ThemedTextColorToken;
}

export function MetricCard({
  helper,
  icon,
  label,
  style,
  value,
  valueToken = 'primary',
}: MetricCardProps) {
  return (
    <GlassCard style={[styles.root, style]} variant="soft">
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

      <ThemedText colorToken="secondary" variant="label">
        {label}
      </ThemedText>

      <ThemedText
        colorToken={valueToken}
        style={styles.value}
        variant="heading"
      >
        {value}
      </ThemedText>

      {helper ? (
        <ThemedText colorToken="secondary" variant="bodySmall">
          {helper}
        </ThemedText>
      ) : null}
    </GlassCard>
  );
}

function View(props: { style: StyleProp<ViewStyle>; children?: ReactNode }) {
  const { View: RNView } =
    require('react-native') as typeof import('react-native');
  return <RNView {...props} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 148,
  },
  iconWrap: {
    marginBottom: 4,
  },
  value: {
    letterSpacing: -0.5,
  },
});
