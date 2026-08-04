import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import {
  AttendanceIcon,
  GlassCard,
  SectionHeader,
  Skeleton,
  ThemedText,
} from '@/theme/primitives';
import type { RecentHistoryItem } from './format';
import { formatCompactDate, formatTime } from './format';

export interface RecentHistoryCardProps {
  currentTimezone: string;
  onPressViewAll: () => void;
  recentEvents: RecentHistoryItem[];
}

export function RecentHistoryCard({
  currentTimezone,
  onPressViewAll,
  recentEvents,
}: RecentHistoryCardProps) {
  const theme = useTheme();

  return (
    <GlassCard style={styles.historyCard} variant="soft">
      <SectionHeader
        actionLabel="Ver todo"
        actionProps={{ onPress: onPressViewAll }}
        title="Historial reciente"
      />

      {recentEvents.length === 0 ? (
        <ThemedText colorToken="secondary" variant="bodySmall">
          Todavía no hay registros.
        </ThemedText>
      ) : (
        recentEvents.map((event) => (
          <View
            key={event.id}
            style={[
              styles.historyRow,
              {
                backgroundColor: theme.surface.glass.soft,
                borderColor: theme.surface.glass.border,
              },
            ]}
          >
            <AttendanceIcon
              direction={event.type === 'clock_in' ? 'in' : 'out'}
              size="md"
            />

            <View style={styles.historyInfo}>
              <ThemedText variant="subtitle">
                {event.type === 'clock_in' ? 'Entrada' : 'Salida'}
              </ThemedText>
              <ThemedText colorToken="secondary" variant="bodySmall">
                {event.officeName}
              </ThemedText>
            </View>

            <View style={styles.historyMeta}>
              <ThemedText style={styles.historyTime} variant="subtitle">
                {formatTime(event.occurredAt, currentTimezone)}
              </ThemedText>
              <ThemedText
                colorToken="secondary"
                style={styles.historyDate}
                variant="bodySmall"
              >
                {formatCompactDate(event.occurredAt, currentTimezone)}
              </ThemedText>
            </View>
          </View>
        ))
      )}
    </GlassCard>
  );
}

export function HistorySkeleton() {
  return (
    <GlassCard style={styles.historyCard} variant="soft">
      <View style={styles.skeletonHistoryHeader}>
        <Skeleton style={styles.skeletonHistoryTitle} />
        <Skeleton style={styles.skeletonHistoryAction} />
      </View>

      {Array.from({ length: 3 }).map((_, index) => (
        <View
          key={`history-skeleton-${index}`}
          style={styles.skeletonHistoryRow}
        >
          <Skeleton style={styles.skeletonHistoryIcon} />

          <View style={styles.skeletonHistoryInfo}>
            <Skeleton style={styles.skeletonHistoryLinePrimary} />
            <Skeleton style={styles.skeletonHistoryLineSecondary} />
          </View>

          <View style={styles.skeletonHistoryMeta}>
            <Skeleton style={styles.skeletonHistoryLineTime} />
            <Skeleton style={styles.skeletonHistoryLineDate} />
          </View>
        </View>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    gap: 16,
  },
  historyRow: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  historyInfo: {
    flex: 1,
    gap: 4,
  },
  historyMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyTime: {
    textAlign: 'right',
  },
  historyDate: {
    textAlign: 'right',
  },
  skeletonHistoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonHistoryTitle: {
    borderRadius: 12,
    height: 24,
    width: 180,
  },
  skeletonHistoryAction: {
    borderRadius: 10,
    height: 16,
    width: 64,
  },
  skeletonHistoryRow: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  skeletonHistoryIcon: {
    borderRadius: 999,
    height: 40,
    width: 40,
  },
  skeletonHistoryInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonHistoryLinePrimary: {
    borderRadius: 10,
    height: 18,
    width: '56%',
  },
  skeletonHistoryLineSecondary: {
    borderRadius: 8,
    height: 14,
    width: '72%',
  },
  skeletonHistoryMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  skeletonHistoryLineTime: {
    borderRadius: 8,
    height: 16,
    width: 56,
  },
  skeletonHistoryLineDate: {
    borderRadius: 8,
    height: 14,
    width: 74,
  },
});
