import { StyleSheet, View } from 'react-native';

import { GlassCard, MetricCard, Skeleton } from '@/theme/primitives';
import { formatMinutes } from './format';

export interface WeeklyMetricsProps {
  weeklyAttendedDays: number;
  weeklyMinutes: number;
}

export function WeeklyMetrics({
  weeklyAttendedDays,
  weeklyMinutes,
}: WeeklyMetricsProps) {
  return (
    <View style={styles.metricsRow}>
      <MetricCard
        label="Horas semanales"
        value={formatMinutes(weeklyMinutes)}
      />
      <MetricCard
        label="Dias asistidos semana"
        value={`${weeklyAttendedDays} dias`}
      />
    </View>
  );
}

export function MetricsSkeleton() {
  return (
    <View style={styles.metricsRow}>
      <MetricSkeletonCard />
      <MetricSkeletonCard />
    </View>
  );
}

function MetricSkeletonCard() {
  return (
    <GlassCard style={styles.metricCard} variant="soft">
      <Skeleton style={styles.skeletonMetricIcon} />
      <Skeleton style={styles.skeletonMetricValue} />
      <Skeleton style={styles.skeletonMetricLabel} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    gap: 8,
    minHeight: 148,
    justifyContent: 'space-between',
  },
  skeletonMetricIcon: {
    borderRadius: 999,
    height: 36,
    width: 36,
  },
  skeletonMetricValue: {
    borderRadius: 12,
    height: 30,
    width: '72%',
  },
  skeletonMetricLabel: {
    borderRadius: 10,
    height: 18,
    width: '58%',
  },
});
