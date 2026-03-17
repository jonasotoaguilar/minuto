import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { Spacing } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  type AttendanceRecord,
  getPaginatedAttendanceRecords,
} from '@/lib/attendance';

const PAGE_SIZE = 10;

export default function ControlHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [page, setPage] = useState(0);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const loadRecords = useCallback(async () => {
    if (!activeOrganization) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await getPaginatedAttendanceRecords({
        organizationId: activeOrganization.id,
        membershipId: activeOrganization.membershipId,
        page,
        pageSize: PAGE_SIZE,
        startDate: appliedStartDate || undefined,
        endDate: appliedEndDate || undefined,
      });

      setRecords(response.records);
      setTotalRecords(response.total);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el historial completo.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization, appliedEndDate, appliedStartDate, page]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const applyFilters = () => {
    setPage(0);
    setAppliedStartDate(startDateInput.trim());
    setAppliedEndDate(endDateInput.trim());
  };

  if (isLoadingOrganizations) {
    return (
      <View
        style={[styles.loaderContainer, { backgroundColor: theme.background }]}
      >
        <Text style={[styles.loaderText, { color: theme.textSecondary }]}>
          Cargando organizaciones...
        </Text>
      </View>
    );
  }

  if (!activeOrganization || isOrganizationSetupOpen) {
    return <OrganizationSetupView />;
  }

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: theme.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.three,
        paddingBottom: insets.bottom + 110,
        paddingHorizontal: Spacing.three,
        gap: Spacing.three,
      }}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.replace('/(tabs)/control' as never)}
          style={[
            styles.backButton,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <Text style={[styles.backButtonText, { color: theme.text }]}>
            Atras
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>
          Historial completo
        </Text>
      </View>

      <View
        style={[
          styles.filtersCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.dateInputsRow}>
          <View style={styles.dateInputContainer}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              Desde
            </Text>
            <TextInput
              value={startDateInput}
              onChangeText={setStartDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              style={[
                styles.dateInput,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.surfaceMuted,
                },
              ]}
            />
          </View>
          <View style={styles.dateInputContainer}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              Hasta
            </Text>
            <TextInput
              value={endDateInput}
              onChangeText={setEndDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              style={[
                styles.dateInput,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.surfaceMuted,
                },
              ]}
            />
          </View>
        </View>

        <Pressable
          onPress={applyFilters}
          style={[styles.applyButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.applyButtonText}>Aplicar filtros</Text>
        </Pressable>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {errorMessage}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.tableCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text
            style={[
              styles.headerCell,
              styles.dateColumn,
              { color: theme.textSecondary },
            ]}
          >
            Fecha
          </Text>
          <Text style={[styles.headerCell, { color: theme.textSecondary }]}>
            Entrada
          </Text>
          <Text style={[styles.headerCell, { color: theme.textSecondary }]}>
            Salida
          </Text>
          <Text
            style={[
              styles.headerCell,
              styles.statusColumn,
              { color: theme.textSecondary },
            ]}
          >
            Estado
          </Text>
        </View>

        {records.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {isLoading ? 'Cargando...' : 'No hay registros con esos filtros.'}
          </Text>
        ) : (
          records.map((record) => {
            const isCompleted = Boolean(record.clockOutAt);
            return (
              <View key={record.id} style={styles.tableRow}>
                <Text
                  style={[
                    styles.bodyCell,
                    styles.dateColumn,
                    { color: theme.text },
                  ]}
                >
                  {record.workDate}
                </Text>
                <Text style={[styles.bodyCell, { color: theme.text }]}>
                  {formatTime(record.clockInAt, activeOrganization.timezone)}
                </Text>
                <Text style={[styles.bodyCell, { color: theme.text }]}>
                  {record.clockOutAt
                    ? formatTime(record.clockOutAt, activeOrganization.timezone)
                    : '--:--'}
                </Text>
                <Text
                  style={[
                    styles.bodyCell,
                    styles.statusColumn,
                    {
                      color: isCompleted ? theme.primary : theme.textSecondary,
                    },
                  ]}
                >
                  {isCompleted ? 'Completo' : 'Abierto'}
                </Text>
              </View>
            );
          })
        )}

        <View style={styles.paginationRow}>
          <Pressable
            onPress={() =>
              setPage((currentPage) => Math.max(0, currentPage - 1))
            }
            disabled={page === 0}
            style={[
              styles.paginationButton,
              {
                backgroundColor:
                  page === 0 ? theme.surfaceMuted : theme.primaryMuted,
              },
            ]}
          >
            <Text style={[styles.paginationButtonText, { color: theme.text }]}>
              Anterior
            </Text>
          </Pressable>

          <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
            Pagina {Math.min(page + 1, totalPages)} de {totalPages}
          </Text>

          <Pressable
            onPress={() =>
              setPage((currentPage) =>
                currentPage + 1 < totalPages ? currentPage + 1 : currentPage,
              )
            }
            disabled={page + 1 >= totalPages}
            style={[
              styles.paginationButton,
              {
                backgroundColor:
                  page + 1 >= totalPages
                    ? theme.surfaceMuted
                    : theme.primaryMuted,
              },
            ]}
          >
            <Text style={[styles.paginationButtonText, { color: theme.text }]}>
              Siguiente
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  filtersCard: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dateInputContainer: {
    flex: 1,
    gap: Spacing.one,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  applyButton: {
    borderRadius: 12,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tableCard: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tableHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#DDE7E1',
    paddingBottom: Spacing.two,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  headerCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  bodyCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  dateColumn: {
    flex: 1.2,
  },
  statusColumn: {
    flex: 0.9,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: Spacing.two,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  paginationButton: {
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  paginationButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pageInfo: {
    fontSize: 12,
    fontWeight: '600',
  },
});
