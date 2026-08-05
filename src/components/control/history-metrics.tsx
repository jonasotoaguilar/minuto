import { StyleSheet, View } from 'react-native';

import { formatMinutes } from '@/components/control/format';
import type { HistorySummary } from '@/components/control/history-format';
import { formatWeeklyHours } from '@/components/control/history-format';
import { GlassCard, ThemedText } from '@/theme/primitives';

export interface HistoryMetricsProps {
  summary: HistorySummary;
}

export function HistoryMetrics({ summary }: HistoryMetricsProps) {
  return (
    <View style={styles.metricsGrid}>
      <MetricCard
        label="Horas totales"
        value={formatMinutes(summary.totalMinutes)}
        valueToken="success"
      />
      <View style={styles.metricsSubRow}>
        <MetricCard label="Días asistidos" value={`${summary.workedDays}`} />
        <MetricCard
          label="Horas extra"
          value={formatMinutes(summary.overtimeMinutes)}
          valueToken="error"
          helper={`+${formatWeeklyHours(summary.weeklyHours)} horas semanal`}
        />
      </View>
    </View>
  );
}

function MetricCard({
  label,
  value,
  valueToken,
  helper,
}: {
  label: string;
  value: string;
  valueToken?: 'success' | 'error' | 'secondary' | 'primary';
  helper?: string;
}) {
  return (
    <GlassCard style={styles.metricCard} variant="soft">
      <ThemedText
        colorToken="secondary"
        style={styles.metricLabel}
        variant="bodySmall"
      >
        {label}
      </ThemedText>
      <ThemedText
        colorToken={valueToken}
        style={styles.metricValue}
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

const styles = StyleSheet.create({
  metricsGrid: {
    gap: 12,
  },
  metricsSubRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  metricLabel: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
});
