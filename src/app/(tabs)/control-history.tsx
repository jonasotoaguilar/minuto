import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  type AttendancePeriod,
  EMPTY_SUMMARY,
  formatAttendanceMonthLabel,
  getAdjacentPeriod,
  getCurrentAttendancePeriod,
  getTodayDateString,
  type HistoryDisplayRow,
  type HistorySummary,
} from '@/components/control/history-format';
import { HistoryMetrics } from '@/components/control/history-metrics';
import { HistoryPeriodCard } from '@/components/control/history-period-card';
import { HistoryRecordList } from '@/components/control/history-record-list';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { SecondaryScreenHeader } from '@/components/secondary-screen-header';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { getAttendanceHistoryPage } from '@/lib/attendance';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
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
    <Screen contentContainerStyle={styles.container}>
      <HistoryRecordList
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: BottomTabInset + theme.spacing['2xl'],
        }}
        currentTimezone={currentTimezone}
        footer={
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
        }
        header={
          <View style={styles.headerBlock}>
            <SecondaryScreenHeader
              title="Historial control"
              subtitle="Revisá tus marcaciones del mes y navegá entre períodos con actividad."
              onBack={() => router.replace('/(tabs)/control' as never)}
            />

            <HistoryPeriodCard
              errorMessage={errorMessage}
              nextDisabled={!nextPeriod || isLoading}
              onNext={() =>
                nextPeriod ? handleChangePeriod(nextPeriod) : undefined
              }
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
          </View>
        }
        isLoading={isLoading}
        rows={displayRows}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    maxWidth: 960,
    paddingHorizontal: 16,
    width: '100%',
  },
  headerBlock: {
    gap: 16,
    marginBottom: 4,
  },
  loaderContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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
