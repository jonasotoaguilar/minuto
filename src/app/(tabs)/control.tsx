import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { StatusPill } from '@/components/status-pill';
import { Fonts, Spacing } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  type AttendanceEvent,
  type AttendanceRecord,
  calculateWeeklyTotals,
  getAttendanceRecordsForRange,
  getOrganizationToday,
  getOrganizationWeekRange,
  getRecentAttendanceEvents,
  getTodayAttendanceRecord,
  registerClockIn,
  registerClockOut,
} from '@/lib/attendance';

const LOCATION_UNAVAILABLE_MESSAGE = 'Servicio de ubicación no disponible.';
const LOCATION_WEB_SECURE_CONTEXT_MESSAGE =
  'En web, la ubicación requiere HTTPS o localhost.';

export default function ControlScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();

  const [now, setNow] = useState(() => new Date());
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyAttendedDays, setWeeklyAttendedDays] = useState(0);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [isLocationAvailable, setIsLocationAvailable] = useState(false);
  const [locationStatusMessage, setLocationStatusMessage] = useState(
    'Verificando servicio de ubicacion...',
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const refreshLocationAvailability = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        if (
          typeof window !== 'undefined' &&
          'isSecureContext' in window &&
          !window.isSecureContext
        ) {
          setIsLocationAvailable(false);
          setLocationStatusMessage(LOCATION_WEB_SECURE_CONTEXT_MESSAGE);
          return false;
        }

        if (typeof navigator !== 'undefined' && !('geolocation' in navigator)) {
          setIsLocationAvailable(false);
          setLocationStatusMessage(LOCATION_UNAVAILABLE_MESSAGE);
          return false;
        }
      }

      if (Platform.OS !== 'web') {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          setIsLocationAvailable(false);
          setLocationStatusMessage(LOCATION_UNAVAILABLE_MESSAGE);
          return false;
        }
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') {
        setIsLocationAvailable(false);
        setLocationStatusMessage(LOCATION_UNAVAILABLE_MESSAGE);
        return false;
      }

      setIsLocationAvailable(true);
      setLocationStatusMessage('');
      return true;
    } catch {
      setIsLocationAvailable(false);
      setLocationStatusMessage(LOCATION_UNAVAILABLE_MESSAGE);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshLocationAvailability();
  }, [refreshLocationAvailability]);

  const loadAttendance = useCallback(async () => {
    if (!activeOrganization) return;

    setIsLoadingAttendance(true);
    setErrorMessage('');

    const currentDate = getOrganizationToday(activeOrganization.timezone);
    const week = getOrganizationWeekRange(activeOrganization.timezone);

    try {
      const [today, weeklyRecords, events] = await Promise.all([
        getTodayAttendanceRecord({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          workDate: currentDate,
        }),
        getAttendanceRecordsForRange({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          startDate: week.start,
          endDate: week.end,
        }),
        getRecentAttendanceEvents({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          recordLimit: 12,
          eventLimit: 6,
        }),
      ]);

      const totals = calculateWeeklyTotals(weeklyRecords);

      setTodayRecord(today);
      setWeeklyMinutes(totals.totalMinutes);
      setWeeklyAttendedDays(totals.attendedDays);
      setRecentEvents(events);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el control.',
      );
    } finally {
      setIsLoadingAttendance(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const onRegisterAction = useCallback(async () => {
    if (!activeOrganization) return;

    const workDate = getOrganizationToday(activeOrganization.timezone);
    const occurredAt = new Date().toISOString();

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const canUseLocation = await refreshLocationAvailability();
      if (!canUseLocation) {
        throw new Error(LOCATION_UNAVAILABLE_MESSAGE);
      }

      // El emulador de Android falla con 'Balanced' porque no tiene redes Wi-Fi/celular para triangular.
      // Usamos Highest (que obliga al GPS) y un getLastKnownPositionAsync como fallback rápido.
      let location = await Location.getLastKnownPositionAsync();

      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
      }

      const locationSnapshot = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? null,
      };

      if (!todayRecord?.clockInAt) {
        await registerClockIn({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          workDate,
          clockInAt: occurredAt,
          clockInLocation: locationSnapshot,
        });
      } else if (!todayRecord.clockOutAt) {
        await registerClockOut({
          attendanceId: todayRecord.id,
          clockOutAt: occurredAt,
          clockOutLocation: locationSnapshot,
        });
      }

      await loadAttendance();
    } catch (error) {
      setErrorMessage(
        getLocationErrorMessage(error) ??
          getErrorMessage(error) ??
          'No se pudo guardar el registro.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeOrganization,
    loadAttendance,
    refreshLocationAvailability,
    todayRecord,
  ]);

  const buttonState = useMemo(() => {
    if (!todayRecord?.clockInAt) {
      return {
        label: 'Registrar entrada del dia',
        helper: 'Registra tu entrada para habilitar el control de la jornada.',
        disabled: false,
      };
    }

    if (!todayRecord.clockOutAt) {
      return {
        label: 'Registrar salida del dia',
        helper:
          'Tu entrada ya está registrada. Cerrá la jornada con tu salida.',
        disabled: false,
      };
    }

    return {
      label: 'Jornada completada',
      helper: 'Ya registraste entrada y salida para hoy.',
      disabled: true,
    };
  }, [todayRecord]);

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
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + 110,
        },
      ]}
    >
      <AppHeader />

      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <StatusPill label="ZONA DE TRABAJO VALIDADA" />
        <Text style={[styles.clock, { color: theme.text }]}>
          {formatClock(now, activeOrganization.timezone)}
        </Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>
          {formatLongDate(now, activeOrganization.timezone)}
        </Text>

        <Pressable
          onPress={onRegisterAction}
          disabled={
            isSubmitting ||
            buttonState.disabled ||
            isLoadingAttendance ||
            !isLocationAvailable
          }
          style={[
            styles.primaryButton,
            {
              backgroundColor: buttonState.disabled
                ? theme.surfaceMuted
                : theme.primary,
              opacity: isSubmitting || isLoadingAttendance ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.primaryButtonText,
              { color: buttonState.disabled ? theme.textSecondary : '#FFFFFF' },
            ]}
          >
            {buttonState.label}
          </Text>
        </Pressable>

        <Text style={[styles.helper, { color: theme.textSecondary }]}>
          {isLocationAvailable
            ? buttonState.helper
            : LOCATION_UNAVAILABLE_MESSAGE}
        </Text>

        {locationStatusMessage ? (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {locationStatusMessage}
          </Text>
        ) : null}

        {errorMessage ? (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {errorMessage}
          </Text>
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.backgroundElement,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={[styles.metricIcon, { backgroundColor: theme.primaryMuted }]}
          />
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {formatMinutes(weeklyMinutes)}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Horas semanales
          </Text>
        </View>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.backgroundElement,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={[styles.metricIcon, { backgroundColor: theme.primaryMuted }]}
          />
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {weeklyAttendedDays} dias
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Dias asistidos semana
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Historial Reciente
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/control-history' as never)}
        >
          <Text style={[styles.sectionLink, { color: theme.primary }]}>
            Ver todo
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.historyCard,
          {
            backgroundColor: theme.backgroundElement,
            shadowColor: theme.shadow,
          },
        ]}
      >
        {recentEvents.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Todavía no hay registros.
          </Text>
        ) : (
          recentEvents.map((event) => (
            <View key={event.id} style={styles.historyRow}>
              <View
                style={[
                  styles.historyIcon,
                  {
                    backgroundColor:
                      event.type === 'clock_in'
                        ? theme.primaryMuted
                        : theme.surfaceMuted,
                  },
                ]}
              />
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  {event.type === 'clock_in' ? 'Entrada' : 'Salida'}
                </Text>
                <Text
                  style={[styles.historyPlace, { color: theme.textSecondary }]}
                >
                  {formatCompactDate(
                    event.occurredAt,
                    activeOrganization.timezone,
                  )}
                </Text>
              </View>
              <Text
                style={[styles.historyTime, { color: theme.textSecondary }]}
              >
                {formatTime(event.occurredAt, activeOrganization.timezone)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function formatClock(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatLongDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatCompactDate(value: string, timezone: string) {
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return null;
}

function getLocationErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  if (!message) return null;

  const normalizedMessage = message.toLowerCase();
  const isWebSecureContext =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'isSecureContext' in window &&
    window.isSecureContext;

  if (
    normalizedMessage.includes('not allowed') ||
    normalizedMessage.includes('permission denied')
  ) {
    return 'Permiso de ubicación denegado en el navegador.';
  }

  if (
    normalizedMessage.includes('unknown error acquiring position') ||
    normalizedMessage.includes('position unavailable') ||
    normalizedMessage.includes('location is unavailable')
  ) {
    if (Platform.OS === 'web' && !isWebSecureContext) {
      return LOCATION_WEB_SECURE_CONTEXT_MESSAGE;
    }

    return 'La ubicación del dispositivo está desactivada. Por favor, activá el GPS para registrar asistencia.';
  }

  return null;
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  heroCard: {
    borderRadius: 32,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  clock: {
    fontSize: 44,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  date: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  primaryButton: {
    marginTop: Spacing.two,
    width: '100%',
    paddingVertical: Spacing.two,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  helper: {
    textAlign: 'center',
    fontSize: 12,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.one,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyCard: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyPlace: {
    fontSize: 12,
  },
  historyTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
  },
});
