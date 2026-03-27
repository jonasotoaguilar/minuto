import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OrganizationSetupView } from '@/components/organization-setup-view';
import { SecondaryScreenHeader } from '@/components/secondary-screen-header';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  type AttendanceRecord,
  calculateAttendanceSummary,
  getAllAttendanceRecords,
  getAttendanceMonthOptions,
} from '@/lib/attendance';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
  Chip,
  GlassCard,
  Screen,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

const PAGE_SIZE = 10;
const ALL_HISTORY_FILTER_KEY = 'all-history';
const SUMMARY_CARD_VARIANT = {
  featured: 'featured',
  accent: 'accent',
  default: 'default',
} as const;

type SummaryCardVariant =
  (typeof SUMMARY_CARD_VARIANT)[keyof typeof SUMMARY_CARD_VARIANT];

type YearFilterOption = {
  year: number;
  label: string;
};

type HistoryDisplayRow = {
  key: string;
  type: 'Entrada' | 'Salida';
  datetime: string;
  officeName: string;
  officeIsRemote: boolean;
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

  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [weeklyHours, setWeeklyHours] = useState(40);

  const [page, setPage] = useState(0);
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    ALL_HISTORY_FILTER_KEY,
  );
  const [visibleYear, setVisibleYear] = useState<number | null>(null);

  const loadRecords = useCallback(async () => {
    if (!activeOrganization) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await getAllAttendanceRecords({
        organizationId: activeOrganization.id,
        membershipId: activeOrganization.membershipId,
      });

      setAllRecords(response);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el historial completo.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!activeOrganization) return;

    const fetchWeeklyHours = async () => {
      const { data } = await supabase
        .from('employee_profiles')
        .select('weekly_hours')
        .eq('membership_id', activeOrganization.membershipId)
        .maybeSingle();

      if (data?.weekly_hours != null) {
        setWeeklyHours(Number(data.weekly_hours));
      }
    };

    void fetchWeeklyHours();
  }, [activeOrganization]);

  const monthOptions = useMemo(
    () => getAttendanceMonthOptions(allRecords),
    [allRecords],
  );

  const yearOptions = useMemo<YearFilterOption[]>(() => {
    const years = new Set<number>();

    for (const option of monthOptions) {
      years.add(option.year);
    }

    return Array.from(years)
      .sort((left, right) => right - left)
      .map((year) => ({ year, label: String(year) }));
  }, [monthOptions]);

  const latestYear = yearOptions[0]?.year ?? null;

  useEffect(() => {
    if (selectedMonthKey === ALL_HISTORY_FILTER_KEY) {
      return;
    }

    const isValidMonth = monthOptions.some(
      (option) => option.key === selectedMonthKey,
    );

    if (!isValidMonth) {
      setSelectedMonthKey(ALL_HISTORY_FILTER_KEY);
    }
  }, [monthOptions, selectedMonthKey]);

  useEffect(() => {
    if (selectedMonthKey !== ALL_HISTORY_FILTER_KEY) {
      const selectedMonth = monthOptions.find(
        (option) => option.key === selectedMonthKey,
      );

      if (selectedMonth && selectedMonth.year !== visibleYear) {
        setVisibleYear(selectedMonth.year);
      }

      return;
    }

    if (visibleYear === null && latestYear !== null) {
      setVisibleYear(latestYear);
      return;
    }

    if (
      visibleYear !== null &&
      !yearOptions.some((option) => option.year === visibleYear)
    ) {
      setVisibleYear(latestYear);
    }
  }, [latestYear, monthOptions, selectedMonthKey, visibleYear, yearOptions]);

  const filteredRecords = useMemo(() => {
    if (selectedMonthKey === ALL_HISTORY_FILTER_KEY) {
      return allRecords;
    }

    return allRecords.filter((record) =>
      record.workDate.startsWith(selectedMonthKey),
    );
  }, [allRecords, selectedMonthKey]);

  const summary = useMemo(
    () => calculateAttendanceSummary(filteredRecords, weeklyHours),
    [filteredRecords, weeklyHours],
  );

  const displayRows = useMemo(() => {
    const rows: HistoryDisplayRow[] = [];

    for (const record of filteredRecords) {
      rows.push({
        key: `${record.id}-in`,
        type: 'Entrada',
        datetime: record.clockInAt,
        officeName: formatOfficeLabel(record),
        officeIsRemote: record.officeIsRemote,
      });

      if (record.clockOutAt) {
        rows.push({
          key: `${record.id}-out`,
          type: 'Salida',
          datetime: record.clockOutAt,
          officeName: formatOfficeLabel(record),
          officeIsRemote: record.officeIsRemote,
        });
      }
    }

    return rows;
  }, [filteredRecords]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const from = page * PAGE_SIZE;
    return displayRows.slice(from, from + PAGE_SIZE);
  }, [displayRows, page]);

  useEffect(() => {
    if (page < totalPages) {
      return;
    }

    setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const activeFilterLabel = useMemo(() => {
    if (selectedMonthKey === ALL_HISTORY_FILTER_KEY) {
      return 'Todo el historial';
    }

    return (
      monthOptions.find((option) => option.key === selectedMonthKey)?.label ??
      'Todo el historial'
    );
  }, [monthOptions, selectedMonthKey]);

  const visibleMonthOptions = useMemo(() => {
    if (visibleYear === null) {
      return [];
    }

    return monthOptions.filter((option) => option.year === visibleYear);
  }, [monthOptions, visibleYear]);

  const handleSelectFilter = useCallback((monthKey: string) => {
    setSelectedMonthKey(monthKey);
    setPage(0);
  }, []);

  const handleSelectYear = useCallback((year: number) => {
    setVisibleYear(year);
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
        subtitle="Revisá tus marcaciones y filtrá por mes y año."
        onBack={() => router.replace('/(tabs)/control' as never)}
      />

      <View style={styles.metricsRow}>
        <SummaryCard
          hint={
            selectedMonthKey === ALL_HISTORY_FILTER_KEY
              ? 'Todo el historial'
              : activeFilterLabel
          }
          label="Horas totales"
          value={formatMinutes(summary.totalMinutes)}
          variant={SUMMARY_CARD_VARIANT.featured}
        />
        <SummaryCard
          hint={`+${weeklyHours} h por semana`}
          label="Horas extras"
          value={formatMinutes(summary.overtimeMinutes)}
          variant={SUMMARY_CARD_VARIANT.accent}
        />
        <SummaryCard
          hint={
            selectedMonthKey === ALL_HISTORY_FILTER_KEY
              ? 'Todo el historial'
              : activeFilterLabel
          }
          label="Días trabajados"
          value={String(summary.workedDays)}
          variant={SUMMARY_CARD_VARIANT.default}
        />
      </View>

      <GlassCard style={styles.filtersCard} variant="soft">
        <SectionHeader
          eyebrow="Periodo"
          subtitle="Solo podés elegir meses con registros reales."
          title={activeFilterLabel}
        />

        <View style={styles.filterToolbar}>
          <FilterChip
            label="Todo el historial"
            isActive={selectedMonthKey === ALL_HISTORY_FILTER_KEY}
            onPress={() => handleSelectFilter(ALL_HISTORY_FILTER_KEY)}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearChipsRow}
          >
            {yearOptions.map((option) => (
              <FilterChip
                key={option.year}
                label={option.label}
                isActive={visibleYear === option.year}
                onPress={() => handleSelectYear(option.year)}
                variant="secondary"
              />
            ))}
          </ScrollView>
        </View>

        {visibleMonthOptions.length > 0 ? (
          <View style={styles.monthGrid}>
            {visibleMonthOptions.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                isActive={selectedMonthKey === option.key}
                onPress={() => handleSelectFilter(option.key)}
              />
            ))}
          </View>
        ) : (
          <ThemedText colorToken="secondary" variant="bodySmall">
            Todavía no hay meses disponibles para filtrar.
          </ThemedText>
        )}

        {errorMessage ? (
          <ThemedText colorToken="error" variant="bodySmall">
            {errorMessage}
          </ThemedText>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.tableCard} variant="soft">
        <View
          style={[
            styles.tableRow,
            styles.tableHeader,
            { borderBottomColor: theme.colors.border.default },
          ]}
        >
          <ThemedText
            colorToken="secondary"
            style={[styles.headerCell, styles.dateColumn]}
            variant="label"
          >
            Fecha
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            style={styles.headerCell}
            variant="label"
          >
            Hora
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            style={styles.headerCell}
            variant="label"
          >
            Tipo
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            style={[styles.headerCell, styles.officeColumn]}
            variant="label"
          >
            Sucursal
          </ThemedText>
        </View>

        {paginatedRows.length === 0 ? (
          <ThemedText
            colorToken="secondary"
            style={styles.emptyText}
            variant="bodySmall"
          >
            {isLoading
              ? 'Cargando...'
              : selectedMonthKey === ALL_HISTORY_FILTER_KEY
                ? 'Todavía no hay registros en el historial.'
                : 'No hay registros para el mes seleccionado.'}
          </ThemedText>
        ) : (
          paginatedRows.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.tableRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.colors.border.default,
                },
              ]}
            >
              <ThemedText
                style={[styles.bodyCell, styles.dateColumn]}
                variant="bodySmall"
              >
                {formatDateTime(row.datetime, currentTimezone)}
              </ThemedText>
              <ThemedText style={styles.bodyCell} variant="bodySmall">
                {formatTime(row.datetime, currentTimezone)}
              </ThemedText>
              <View style={styles.bodyCell}>
                <Chip
                  label={row.type}
                  tone={row.type === 'Entrada' ? 'success' : 'neutral'}
                />
              </View>
              <ThemedText
                style={[styles.bodyCell, styles.officeColumn]}
                variant="bodySmall"
              >
                {row.officeName}
              </ThemedText>
            </View>
          ))
        )}

        <View style={styles.paginationRow}>
          <SecondaryButton
            disabled={page === 0}
            fullWidth={false}
            label="Anterior"
            onPress={() =>
              setPage((currentPage) => Math.max(0, currentPage - 1))
            }
            style={styles.paginationButton}
          />

          <ThemedText colorToken="secondary" variant="bodySmall">
            Pagina {Math.min(page + 1, totalPages)} de {totalPages}
          </ThemedText>

          <SecondaryButton
            disabled={page + 1 >= totalPages}
            fullWidth={false}
            label="Siguiente"
            onPress={() =>
              setPage((currentPage) =>
                currentPage + 1 < totalPages ? currentPage + 1 : currentPage,
              )
            }
            style={styles.paginationButton}
          />
        </View>
      </GlassCard>
    </Screen>
  );
}

type SummaryCardProps = {
  hint: string;
  label: string;
  value: string;
  variant: SummaryCardVariant;
};

function SummaryCard({ hint, label, value, variant }: SummaryCardProps) {
  const theme = useTheme();
  const cardStyle = getSummaryCardStyle(theme, variant);
  const valueToken =
    variant === SUMMARY_CARD_VARIANT.accent ? 'accent' : 'primary';

  return (
    <GlassCard style={[styles.metricCard, cardStyle]} variant="soft">
      <ThemedText colorToken="secondary" variant="label">
        {label}
      </ThemedText>
      <ThemedText
        colorToken={valueToken}
        style={styles.metricValue}
        variant="heading"
      >
        {value}
      </ThemedText>
      <ThemedText colorToken="secondary" variant="bodySmall">
        {hint}
      </ThemedText>
    </GlassCard>
  );
}

type FilterChipProps = {
  isActive: boolean;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'secondary';
};

function FilterChip({
  isActive,
  label,
  onPress,
  variant = 'default',
}: FilterChipProps) {
  return (
    <Chip
      label={label}
      onPress={onPress}
      selected={isActive}
      tone={variant === 'secondary' ? 'neutral' : 'brand'}
    />
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

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function formatOfficeLabel(record: AttendanceRecord) {
  if (record.officeIsRemote) {
    return 'Remoto';
  }

  return record.officeName?.trim() || 'Sin sucursal';
}

function getSummaryCardStyle(
  theme: ReturnType<typeof useTheme>,
  variant: SummaryCardVariant,
) {
  if (variant === SUMMARY_CARD_VARIANT.accent) {
    return {
      backgroundColor: theme.colors.brand.muted,
      borderColor: theme.colors.brand.muted,
    };
  }

  if (variant === SUMMARY_CARD_VARIANT.default) {
    return {
      backgroundColor: theme.surface.glass.soft,
      borderColor: theme.surface.glass.border,
    };
  }

  return {
    backgroundColor: theme.surface.glass.strong,
    borderColor: theme.surface.glass.border,
  };
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
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    flexGrow: 1,
    gap: 8,
    minWidth: '30%',
  },
  metricValue: {
    letterSpacing: -0.4,
  },
  filtersCard: {
    gap: 16,
  },
  filterToolbar: {
    gap: 12,
  },
  yearChipsRow: {
    gap: 8,
    paddingRight: 4,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableCard: {
    gap: 16,
  },
  tableHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
  },
  tableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
    width: '100%',
  },
  headerCell: {
    flex: 1,
  },
  bodyCell: {
    flex: 1,
  },
  dateColumn: {
    flex: 1.2,
  },
  officeColumn: {
    flex: 1.1,
  },
  statusColumn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusCell: {
    justifyContent: 'center',
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
