import type { ReactElement } from 'react';
import {
  FlatList,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { formatMinutes, formatTime } from '@/components/control/format';
import {
  formatWorkdayLabel,
  type HistoryDisplayRow,
  resolveJourneyStatusLabel,
} from '@/components/control/history-format';
import { useTheme } from '@/hooks/use-theme';
import { AttendanceIcon, EmptyState, ThemedText } from '@/theme/primitives';

export interface HistoryRecordListProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
  currentTimezone: string;
  footer: ReactElement;
  header: ReactElement;
  isLoading: boolean;
  rows: HistoryDisplayRow[];
}

export function HistoryRecordList({
  contentContainerStyle,
  currentTimezone,
  footer,
  header,
  isLoading,
  rows,
}: HistoryRecordListProps) {
  return (
    <FlatList
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      keyExtractor={(row) => row.key}
      ListEmptyComponent={
        isLoading ? (
          <ThemedText
            colorToken="secondary"
            style={styles.emptyText}
            variant="bodySmall"
          >
            Cargando...
          </ThemedText>
        ) : (
          <EmptyState
            description="No hay registros para el mes seleccionado."
            title="Sin registros"
          />
        )
      }
      ListFooterComponent={footer}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <HistoryRow currentTimezone={currentTimezone} row={item} />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

interface HistoryRowProps {
  currentTimezone: string;
  row: HistoryDisplayRow;
}

function HistoryRow({ currentTimezone, row }: HistoryRowProps) {
  const theme = useTheme();
  const dayLabel = formatWorkdayLabel(row.workDate, currentTimezone);

  return (
    <View
      style={[
        styles.historyRow,
        {
          backgroundColor: theme.surface.glass.soft,
          borderColor: theme.surface.glass.border,
        },
        !row.hasRecord && {
          borderColor: theme.colors.status.error,
          opacity: 0.9,
        },
      ]}
    >
      <View
        style={[
          styles.dayBadge,
          {
            backgroundColor: row.hasRecord
              ? theme.surface.glass.tint
              : 'rgba(255, 99, 99, 0.12)',
          },
        ]}
      >
        <ThemedText
          colorToken={row.hasRecord ? 'secondary' : 'error'}
          style={styles.dayBadgeWeekday}
          variant="bodySmall"
        >
          {dayLabel.weekday}
        </ThemedText>
        <ThemedText
          colorToken={row.hasRecord ? 'primary' : 'error'}
          style={styles.dayBadgeDay}
          variant="subtitle"
        >
          {dayLabel.day}
        </ThemedText>
      </View>

      <View style={styles.historyInfo}>
        {row.hasRecord ? (
          <View style={styles.journeyTimesRow}>
            <JourneyEvent
              label={
                row.clockInAt
                  ? formatTime(row.clockInAt, currentTimezone)
                  : '--:--'
              }
              tone="Entrada"
            />
            <JourneyEvent
              label={
                row.clockOutAt
                  ? formatTime(row.clockOutAt, currentTimezone)
                  : '--:--'
              }
              tone="Salida"
            />
          </View>
        ) : (
          <ThemedText colorToken="error" style={styles.noRecordText}>
            Sin registro
          </ThemedText>
        )}
        <ThemedText
          colorToken={row.hasRecord ? 'secondary' : 'error'}
          numberOfLines={1}
          style={styles.statusText}
          variant="bodySmall"
        >
          {resolveJourneyStatusLabel(row)}
        </ThemedText>
      </View>

      <View style={styles.historyMeta}>
        <ThemedText style={styles.historyWorkedTime} variant="heading">
          {row.hasRecord ? formatMinutes(row.workedMinutes) : '-'}
        </ThemedText>
      </View>
    </View>
  );
}

interface JourneyEventProps {
  tone: 'Entrada' | 'Salida';
  label: string;
}

function JourneyEvent({ tone, label }: JourneyEventProps) {
  const theme = useTheme();
  const isEntry = tone === 'Entrada';
  const color = isEntry
    ? theme.colors.status.success
    : theme.colors.status.error;

  return (
    <View
      style={[
        styles.journeyEvent,
        isEntry ? styles.journeyEventLeft : styles.journeyEventRight,
      ]}
    >
      <AttendanceIcon
        color={color}
        direction={isEntry ? 'in' : 'out'}
        size="sm"
      />
      <ThemedText style={styles.journeyEventLabel} variant="subtitle">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: 12,
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
  dayBadge: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  dayBadgeWeekday: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dayBadgeDay: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  historyInfo: {
    flex: 1,
    gap: 3,
  },
  journeyTimesRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  journeyEvent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  journeyEventLeft: {
    justifyContent: 'flex-start',
  },
  journeyEventRight: {
    justifyContent: 'flex-end',
  },
  journeyEventLabel: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  noRecordText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  historyMeta: {
    alignItems: 'flex-end',
    minWidth: 120,
    paddingLeft: 8,
  },
  historyWorkedTime: {
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    width: '100%',
  },
  emptyText: {
    paddingVertical: 8,
  },
});
