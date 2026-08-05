import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatMinutes, formatTime } from '@/components/control/format';
import {
  type AttendancePeriod,
  EMPTY_SUMMARY,
  formatAttendanceMonthLabel,
  formatWorkdayLabel,
  getAdjacentPeriod,
  getCurrentAttendancePeriod,
  getTodayDateString,
  type HistoryDisplayRow,
  type HistorySummary,
  resolveJourneyStatusLabel,
} from '@/components/control/history-format';
import { HistoryMetrics } from '@/components/control/history-metrics';
import { HistoryPeriodCard } from '@/components/control/history-period-card';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { SecondaryScreenHeader } from '@/components/secondary-screen-header';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { getAttendanceHistoryPage } from '@/lib/attendance';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
  AttendanceIcon,
  EmptyState,
  Screen,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

const PAGE_SIZE = 10;

export default function ControlHistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();
  const currentTimezone = resolveOrganizationTimezone(
    activeOrganization?.defaultTimezone,
  );

  const currentPeriod = useMemo(
    () => getCurrentAttendancePeriod(currentTimezone),
    [currentTimezone],
  );

  const [availablePeriods, setAvailablePeriods] = useState<AttendancePeriod[]>(
    [],
  );
  const [selectedPeriod, setSelectedPeriod] =
    useState<AttendancePeriod>(currentPeriod);
  const [displayRows, setDisplayRows] = useState<HistoryDisplayRow[]>([]);
  const [summary, setSummary] = useState<HistorySummary>(EMPTY_SUMMARY);
  const [totalPages, setTotalPages] = useState(0);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setSelectedPeriod(currentPeriod);
    setPage(0);
  }, [currentPeriod]);

  const loadRecords = useCallback(async () => {
    if (!activeOrganization) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await getAttendanceHistoryPage({
        organizationId: activeOrganization.id,
        membershipId: activeOrganization.membershipId,
        page,
        pageSize: PAGE_SIZE,
        year: selectedPeriod.year,
        month: selectedPeriod.month,
      });

      const todayInTimezone = getTodayDateString(currentTimezone);
      const shouldHideTodayAbsence =
        selectedPeriod.year === currentPeriod.year &&
        selectedPeriod.month === currentPeriod.month;

      setDisplayRows(
        response.items
          .filter((item) => {
            if (!shouldHideTodayAbsence || item.hasRecord) {
              return true;
            }

            return item.workDate < todayInTimezone;
          })
          .map((item) => ({
            key: item.id,
            workDate: item.workDate,
            hasRecord: item.hasRecord,
            clockInAt: item.clockInAt,
            clockOutAt: item.clockOutAt,
            status: item.status,
            workedMinutes: item.workedMinutes,
          })),
      );

      setAvailablePeriods(
        response.availablePeriods.map((period) => ({
          year: period.year,
          month: period.month,
        })),
      );

      setSummary({
        weeklyHours: response.summary.weeklyHours,
        workedDays: response.summary.workedDays,
        totalMinutes: response.summary.totalMinutes,
        overtimeMinutes: response.summary.overtimeMinutes,
      });
      setTotalPages(response.totalPages);
      setHasPreviousPage(response.hasPreviousPage);
      setHasNextPage(response.hasNextPage);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el historial.',
      );
      setDisplayRows([]);
      setSummary(EMPTY_SUMMARY);
      setTotalPages(0);
      setHasPreviousPage(false);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeOrganization,
    currentPeriod.month,
    currentPeriod.year,
    currentTimezone,
    page,
    selectedPeriod.month,
    selectedPeriod.year,
  ]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (totalPages === 0 || page < totalPages) {
      return;
    }

    setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const previousPeriod = useMemo(
    () =>
      getAdjacentPeriod({
        periods: availablePeriods,
        current: selectedPeriod,
        direction: 'previous',
      }),
    [availablePeriods, selectedPeriod],
  );

  const nextPeriod = useMemo(
    () =>
      getAdjacentPeriod({
        periods: availablePeriods,
        current: selectedPeriod,
        direction: 'next',
      }),
    [availablePeriods, selectedPeriod],
  );

  const handleChangePeriod = useCallback((period: AttendancePeriod) => {
    setSelectedPeriod(period);
    setPage(0);
  }, []);

  if (isLoadingOrganizations) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ThemedText colorToken="secondary" variant="label">
          Cargando organizaciones...
        </ThemedText>
      </Screen>
    );
  }

  if (!activeOrganization || isOrganizationSetupOpen) {
    return <OrganizationSetupView />;
  }

  return (
    <Screen
      scroll
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: theme.spacing.lg,
          paddingBottom: BottomTabInset + theme.spacing['2xl'],
        },
      ]}
      scrollProps={{ contentInsetAdjustmentBehavior: 'automatic' }}
    >
      <SecondaryScreenHeader
        title="Historial control"
        subtitle="Revisá tus marcaciones del mes y navegá entre períodos con actividad."
        onBack={() => router.replace('/(tabs)/control' as never)}
      />

      <HistoryPeriodCard
        errorMessage={errorMessage}
        nextDisabled={!nextPeriod || isLoading}
        onNext={() => (nextPeriod ? handleChangePeriod(nextPeriod) : undefined)}
        periodLabel={formatAttendanceMonthLabel(
          selectedPeriod.year,
          selectedPeriod.month,
        )}
        previousDisabled={!previousPeriod || isLoading}
        onPrevious={() =>
          previousPeriod ? handleChangePeriod(previousPeriod) : undefined
        }
      />

      <HistoryMetrics summary={summary} />

      <SectionHeader title="Detalle de registros" />

      <View style={styles.tableCard}>
        {displayRows.length === 0 ? (
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
        ) : (
          displayRows.map((row) => {
            const dayLabel = formatWorkdayLabel(row.workDate, currentTimezone);

            return (
              <View
                key={row.key}
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
                  <ThemedText
                    style={styles.historyWorkedTime}
                    variant="heading"
                  >
                    {row.hasRecord ? formatMinutes(row.workedMinutes) : '-'}
                  </ThemedText>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.paginationRow}>
          <SecondaryButton
            disabled={!hasPreviousPage || isLoading}
            fullWidth={false}
            label="Anterior"
            onPress={() =>
              setPage((currentPage) => Math.max(0, currentPage - 1))
            }
            style={styles.paginationButton}
          />

          <ThemedText colorToken="secondary" variant="bodySmall">
            Página {Math.min(page + 1, Math.max(totalPages, 1))} de{' '}
            {Math.max(totalPages, 1)}
          </ThemedText>

          <SecondaryButton
            disabled={!hasNextPage || isLoading}
            fullWidth={false}
            label="Siguiente"
            onPress={() =>
              setPage((currentPage) =>
                hasNextPage ? currentPage + 1 : currentPage,
              )
            }
            style={styles.paginationButton}
          />
        </View>
      </View>
    </Screen>
  );
}

type JourneyEventProps = {
  tone: 'Entrada' | 'Salida';
  label: string;
};

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
  container: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 960,
    paddingHorizontal: 16,
    width: '100%',
  },
  loaderContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  tableCard: {
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
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  paginationButton: {
    minWidth: 112,
  },
});
