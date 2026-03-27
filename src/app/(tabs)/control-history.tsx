import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { OrganizationSetupView } from '@/components/organization-setup-view';
import { SecondaryScreenHeader } from '@/components/secondary-screen-header';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  ATTENDANCE_EVENT_TYPE,
  getAttendanceHistoryPage,
} from '@/lib/attendance';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
  GlassCard,
  Screen,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

const PAGE_SIZE = 10;

type AttendancePeriod = {
  year: number;
  month: number;
};

type HistoryDisplayRow = {
  key: string;
  type: 'Entrada' | 'Salida';
  datetime: string;
  officeName: string;
};

type HistorySummary = {
  workedDays: number;
  totalMinutes: number;
  overtimeMinutes: number;
};

const EMPTY_SUMMARY: HistorySummary = {
  workedDays: 0,
  totalMinutes: 0,
  overtimeMinutes: 0,
};

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

      setDisplayRows(
        response.items.map((item) => ({
          key: item.id,
          type:
            item.eventType === ATTENDANCE_EVENT_TYPE.CLOCK_IN
              ? 'Entrada'
              : 'Salida',
          datetime: item.occurredAt,
          officeName: formatOfficeLabel(item.officeName, item.officeIsRemote),
        })),
      );

      setAvailablePeriods(
        response.availablePeriods.map((period) => ({
          year: period.year,
          month: period.month,
        })),
      );

      setSummary({
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
  }, [activeOrganization, page, selectedPeriod.month, selectedPeriod.year]);

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

      <GlassCard style={styles.periodCard} variant="soft">
        <View style={styles.monthNavigationRow}>
          <MonthArrowButton
            accessibilityLabel="Mes anterior"
            direction="previous"
            disabled={!previousPeriod || isLoading}
            onPress={() =>
              previousPeriod ? handleChangePeriod(previousPeriod) : undefined
            }
          />

          <View style={styles.monthLabelContainer}>
            <ThemedText selectable style={styles.monthLabel} variant="heading">
              {formatAttendanceMonthLabel(
                selectedPeriod.year,
                selectedPeriod.month,
              )}
            </ThemedText>
          </View>

          <MonthArrowButton
            accessibilityLabel="Mes siguiente"
            direction="next"
            disabled={!nextPeriod || isLoading}
            onPress={() =>
              nextPeriod ? handleChangePeriod(nextPeriod) : undefined
            }
          />
        </View>

        {errorMessage ? (
          <ThemedText colorToken="error" variant="bodySmall">
            {errorMessage}
          </ThemedText>
        ) : null}
      </GlassCard>

      <View style={styles.metricsRow}>
        <MetricCard
          label="Días asistidos"
          value={`${summary.workedDays} días`}
        />
        <MetricCard
          label="Horas trabajadas"
          value={formatMinutes(summary.totalMinutes)}
        />
        <MetricCard
          label="Horas extras"
          value={formatMinutes(summary.overtimeMinutes)}
        />
      </View>

      <View style={styles.tableCard}>
        {displayRows.length === 0 ? (
          <ThemedText
            colorToken="secondary"
            style={styles.emptyText}
            variant="bodySmall"
          >
            {isLoading
              ? 'Cargando...'
              : 'No hay registros para el mes seleccionado.'}
          </ThemedText>
        ) : (
          displayRows.map((row) => (
            <View
              key={row.key}
              style={[
                styles.historyRow,
                {
                  backgroundColor: theme.surface.glass.soft,
                  borderColor: theme.surface.glass.border,
                },
              ]}
            >
              <AttendanceTypeIcon tone={row.type} />

              <View style={styles.historyInfo}>
                <ThemedText variant="subtitle">{row.type}</ThemedText>
                <ThemedText colorToken="secondary" variant="bodySmall">
                  {row.officeName}
                </ThemedText>
              </View>

              <View style={styles.historyMeta}>
                <ThemedText style={styles.historyTime} variant="subtitle">
                  {formatTime(row.datetime, currentTimezone)}
                </ThemedText>
                <ThemedText
                  colorToken="secondary"
                  style={styles.historyDate}
                  variant="bodySmall"
                >
                  {formatDateTime(row.datetime, currentTimezone)}
                </ThemedText>
              </View>
            </View>
          ))
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

type AttendanceTypeIconProps = {
  tone: 'Entrada' | 'Salida';
};

function AttendanceTypeIcon({ tone }: AttendanceTypeIconProps) {
  const theme = useTheme();
  const isEntry = tone === 'Entrada';
  const color = isEntry
    ? theme.colors.status.success
    : theme.colors.status.error;

  return (
    <View
      style={[
        styles.typeIconShell,
        {
          backgroundColor: isEntry
            ? theme.surface.glass.tint
            : theme.surface.glass.soft,
          borderColor: color,
          transform: [{ scaleX: isEntry ? -1 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.typeIconFrameVertical,
          { left: 11, backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.typeIconFrameHorizontal,
          {
            left: 11,
            top: 12,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.typeIconFrameHorizontal,
          {
            left: 11,
            bottom: 12,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.typeIconArrowShaft,
          {
            backgroundColor: color,
            left: 18,
          },
        ]}
      />
      <View
        style={[
          styles.typeIconArrowHead,
          {
            borderLeftColor: 'transparent',
            borderRightColor: color,
            left: 10,
          },
        ]}
      />
    </View>
  );
}

type MonthArrowButtonProps = {
  accessibilityLabel: string;
  direction: 'previous' | 'next';
  disabled: boolean;
  onPress: () => void;
};

function MonthArrowButton({
  accessibilityLabel,
  direction,
  disabled,
  onPress,
}: MonthArrowButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monthArrowButton,
        {
          backgroundColor: theme.surface.glass.soft,
          borderColor: theme.surface.glass.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <ThemedText style={styles.monthArrowLabel} variant="heading">
        {direction === 'previous' ? '‹' : '›'}
      </ThemedText>
    </Pressable>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <GlassCard style={styles.metricCard} variant="soft">
      <View
        style={[
          styles.metricIcon,
          {
            backgroundColor: theme.surface.glass.tint,
            borderColor: theme.surface.glass.border,
          },
        ]}
      />
      <ThemedText style={styles.metricValue} variant="heading">
        {value}
      </ThemedText>
      <ThemedText colorToken="secondary" variant="bodySmall">
        {label}
      </ThemedText>
    </GlassCard>
  );
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatOfficeLabel(officeName: string | null, officeIsRemote: boolean) {
  if (officeIsRemote) {
    return 'Remoto';
  }

  return officeName?.trim() || 'Sin sucursal';
}

function formatAttendanceMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function getCurrentAttendancePeriod(timezone: string): AttendancePeriod {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  if (Number.isInteger(year) && Number.isInteger(month)) {
    return { year, month };
  }

  const now = new Date();

  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

function getAdjacentPeriod(params: {
  periods: AttendancePeriod[];
  current: AttendancePeriod;
  direction: 'previous' | 'next';
}): AttendancePeriod | null {
  const currentValue = params.current.year * 100 + params.current.month;

  if (params.direction === 'previous') {
    const previous = [...params.periods]
      .filter((period) => period.year * 100 + period.month < currentValue)
      .sort(
        (left, right) =>
          right.year * 100 + right.month - (left.year * 100 + left.month),
      )[0];

    return previous ?? null;
  }

  const next = [...params.periods]
    .filter((period) => period.year * 100 + period.month > currentValue)
    .sort(
      (left, right) =>
        left.year * 100 + left.month - (right.year * 100 + right.month),
    )[0];

  return next ?? null;
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
  periodCard: {
    gap: 16,
  },
  monthNavigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  monthLabelContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  monthLabel: {
    textTransform: 'capitalize',
  },
  monthArrowButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  monthArrowLabel: {
    lineHeight: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 138,
  },
  metricIcon: {
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    width: 36,
  },
  metricValue: {
    letterSpacing: -0.4,
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
  typeIconShell: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: 40,
  },
  typeIconFrameVertical: {
    borderRadius: 999,
    height: 16,
    position: 'absolute',
    top: 12,
    width: 2,
  },
  typeIconFrameHorizontal: {
    borderRadius: 999,
    height: 2,
    position: 'absolute',
    width: 10,
  },
  typeIconArrowShaft: {
    borderRadius: 999,
    height: 2,
    position: 'absolute',
    top: 19,
    width: 12,
  },
  typeIconArrowHead: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 5,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopColor: 'transparent',
    borderTopWidth: 5,
    position: 'absolute',
    top: 14,
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
