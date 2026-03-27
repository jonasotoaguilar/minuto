import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useProximityValidation } from '@/hooks/use-proximity-validation';
import { useTheme } from '@/hooks/use-theme';
import {
  type AttendanceEvent,
  type AttendanceLocation,
  type AttendanceRecord,
  calculateWeeklyTotals,
  getAttendanceRecordsForRange,
  getOpenShift,
  getOrganizationToday,
  getOrganizationWeekRange,
  getRecentAttendanceEvents,
  getTodayAttendanceRecord,
  type OpenShift,
  ProximityError,
  registerClockIn,
  registerClockOut,
  validateProximity,
} from '@/lib/attendance';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
  Chip,
  GlassCard,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

const CONTROL_MODE = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  VALID: 'valid',
  OUT_OF_RANGE: 'out_of_range',
  GPS_ERROR: 'gps_error',
  REMOTE: 'remote',
  CLOCKED_IN: 'clocked_in',
  COMPLETED: 'completed',
} as const;

type ControlMode = (typeof CONTROL_MODE)[keyof typeof CONTROL_MODE];

const VALIDATION_TIMEOUT_MS = 5 * 60 * 1000;

export default function ControlScreen() {
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

  const proximity = useProximityValidation();

  const [now, setNow] = useState(() => new Date());
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [openShiftRecord, setOpenShiftRecord] = useState<OpenShift | null>(
    null,
  );
  const [isOvertimeModalVisible, setIsOvertimeModalVisible] = useState(false);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyAttendedDays, setWeeklyAttendedDays] = useState(0);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!activeOrganization) return;

    setIsLoadingAttendance(true);
    setErrorMessage('');

    const currentDate = getOrganizationToday(currentTimezone);
    const week = getOrganizationWeekRange(currentTimezone);

    try {
      const [today, weeklyRecords, events, openShift] = await Promise.all([
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
        getOpenShift(activeOrganization.membershipId),
      ]);

      const totals = calculateWeeklyTotals(weeklyRecords);

      setTodayRecord(today);
      setOpenShiftRecord(openShift);
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
  }, [activeOrganization, currentTimezone]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const hasActiveClockIn = Boolean(openShiftRecord?.clockInAt);

  const organizationToday = getOrganizationToday(currentTimezone);

  const isCrossDateOpenShift = Boolean(
    openShiftRecord && openShiftRecord.workDate !== organizationToday,
  );

  const hasCompletedDay = Boolean(
    todayRecord?.clockInAt && todayRecord.clockOutAt,
  );

  const controlMode = useMemo<ControlMode>(() => {
    if (hasActiveClockIn) {
      return CONTROL_MODE.CLOCKED_IN;
    }

    if (hasCompletedDay) {
      return CONTROL_MODE.COMPLETED;
    }

    switch (proximity.state.status) {
      case 'loading':
        return CONTROL_MODE.VALIDATING;
      case 'valid':
        return CONTROL_MODE.VALID;
      case 'out_of_range':
        return CONTROL_MODE.OUT_OF_RANGE;
      case 'blocked':
        return CONTROL_MODE.GPS_ERROR;
      case 'remote':
        return CONTROL_MODE.REMOTE;
      case 'idle':
      default:
        return CONTROL_MODE.IDLE;
    }
  }, [hasActiveClockIn, hasCompletedDay, proximity.state.status]);

  useEffect(() => {
    if (controlMode !== CONTROL_MODE.VALID) {
      return;
    }

    const timeoutId = setTimeout(() => {
      proximity.reset();
      setErrorMessage('La validación expiró. Volvé a validar tu ubicación.');
    }, VALIDATION_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [controlMode, proximity.reset]);

  useEffect(() => {
    if (!openShiftRecord) {
      setIsOvertimeModalVisible(false);
      return;
    }

    const syncOvertimeVisibility = () => {
      setIsOvertimeModalVisible(isOvertimeThresholdExceeded(openShiftRecord));
    };

    syncOvertimeVisibility();

    const intervalId = setInterval(syncOvertimeVisibility, 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [openShiftRecord]);

  const onValidateLocation = useCallback(async () => {
    if (!activeOrganization || hasActiveClockIn || hasCompletedDay) {
      return;
    }

    setErrorMessage('');

    const location = await proximity.validateLocation();

    if (!location) {
      return;
    }

    try {
      const result = await validateProximity({
        organizationId: activeOrganization.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });

      proximity.setValidationResult({
        success: result.valid,
        officeId: result.officeId,
        officeName: result.officeName,
        errorCode: result.errorCode,
      });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error) ?? 'No se pudo validar tu ubicación.',
      );
      proximity.reset();
    }
  }, [activeOrganization, hasActiveClockIn, hasCompletedDay, proximity]);

  const submitClockOut = useCallback(
    async (options: {
      attendanceId: string;
      autoClosed?: boolean;
      customCloseAt?: string;
    }) => {
      const clockOutLocation = {
        latitude: 0,
        longitude: 0,
        accuracy: null,
        isRemote: true,
      } satisfies AttendanceLocation;

      await registerClockOut({
        attendanceId: options.attendanceId,
        autoClosed: options.autoClosed,
        clockOutAt: new Date().toISOString(),
        clockOutLocation,
        customCloseAt: options.customCloseAt,
      });

      setIsOvertimeModalVisible(false);
    },
    [],
  );

  const onRegisterAction = useCallback(async () => {
    if (!activeOrganization) {
      return;
    }

    const workDate = getOrganizationToday(currentTimezone);
    const occurredAt = new Date().toISOString();

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (!openShiftRecord?.clockInAt) {
        const isRemote = controlMode === CONTROL_MODE.REMOTE;
        const validatedLocation = proximity.state.location;

        if (!isRemote) {
          if (controlMode !== CONTROL_MODE.VALID) {
            setErrorMessage(
              'Primero validá tu ubicación antes de registrar la entrada.',
            );
            return;
          }

          if (!validatedLocation || !proximity.state.officeId) {
            setErrorMessage(
              'La validación no está completa. Volvé a intentarlo.',
            );
            proximity.reset();
            return;
          }
        }

        const locationSnapshot = isRemote
          ? {
              latitude: 0,
              longitude: 0,
              accuracy: null,
              isRemote: true,
            }
          : {
              latitude: validatedLocation!.latitude,
              longitude: validatedLocation!.longitude,
              accuracy: validatedLocation!.accuracy,
              isRemote: false,
            };

        const result = await registerClockIn({
          organizationId: activeOrganization.id,
          membershipId: activeOrganization.membershipId,
          workDate,
          clockInAt: occurredAt,
          clockInLocation: locationSnapshot,
          officeId: isRemote ? undefined : proximity.state.officeId,
        });

        if (!isRemote) {
          proximity.setValidationResult({
            success: true,
            officeId: result?.officeId,
            officeName: result?.officeName,
          });
        }
      } else if (openShiftRecord) {
        await submitClockOut({ attendanceId: openShiftRecord.recordId });
      }

      await loadAttendance();
      proximity.reset();
    } catch (error) {
      if (error instanceof ProximityError) {
        if (error.code === 'GPS_ACCURACY_TOO_LOW') {
          proximity.setValidationResult({
            success: false,
            errorCode: 'GPS_ACCURACY_TOO_LOW',
          });
          setErrorMessage(error.message);
        } else if (error.code === 'OUT_OF_RANGE') {
          proximity.setValidationResult({
            success: false,
            errorCode: 'OUT_OF_RANGE',
          });
          setErrorMessage(error.message);
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage(
          getErrorMessage(error) ?? 'No se pudo guardar el registro.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeOrganization,
    controlMode,
    currentTimezone,
    loadAttendance,
    openShiftRecord,
    proximity,
    submitClockOut,
  ]);

  const proximityStatus = useMemo(() => {
    switch (controlMode) {
      case CONTROL_MODE.VALIDATING:
        return {
          chipLabel: 'Obteniendo ubicación...',
          chipTone: 'brand' as const,
        };
      case CONTROL_MODE.VALID: {
        return {
          chipLabel: 'Ubicación validada',
          chipTone: 'success' as const,
          helper: proximity.state.officeName
            ? `✓ ${proximity.state.officeName}`
            : 'Ubicación validada.',
        };
      }
      case CONTROL_MODE.OUT_OF_RANGE:
        return {
          chipLabel: 'Fuera de rango',
          chipTone: 'warning' as const,
          helper: '⚠ Fuera de rango. Reintentá o registrate como remoto.',
        };
      case CONTROL_MODE.GPS_ERROR:
        return {
          chipLabel: 'Error de GPS',
          chipTone: 'danger' as const,
          helper: getBlockedMessage(proximity.state.errorReason),
        };
      case CONTROL_MODE.REMOTE:
        return {
          chipLabel: 'Trabajo Remoto',
          chipTone: 'brand' as const,
          helper: '📍 Remoto',
        };
      case CONTROL_MODE.CLOCKED_IN:
        return {
          chipLabel: isCrossDateOpenShift
            ? 'Jornada pendiente'
            : 'Jornada activa',
          chipTone: isCrossDateOpenShift
            ? ('warning' as const)
            : ('success' as const),
          helper: openShiftRecord?.officeIsRemote
            ? '📍 Remoto'
            : openShiftRecord?.officeName
              ? `✓ ${openShiftRecord.officeName}`
              : 'Tu jornada está activa.',
        };
      case CONTROL_MODE.COMPLETED:
        return {
          chipLabel: 'Jornada completada',
          chipTone: 'neutral' as const,
          helper: 'Ya registraste la entrada y la salida de hoy.',
        };
      case CONTROL_MODE.IDLE:
      default:
        return {
          chipLabel: 'Sin validar',
          chipTone: 'neutral' as const,
          helper: 'Validá tu ubicación antes de registrar la entrada.',
        };
    }
  }, [
    controlMode,
    proximity.state.errorReason,
    proximity.state.officeName,
    isCrossDateOpenShift,
    openShiftRecord?.officeIsRemote,
    openShiftRecord?.officeName,
  ]);

  const buttonState = useMemo(() => {
    if (controlMode === CONTROL_MODE.CLOCKED_IN) {
      return {
        label: isCrossDateOpenShift
          ? 'Registrar salida de la jornada pendiente'
          : 'Registrar salida',
        helper: isCrossDateOpenShift
          ? 'Primero cerrá la jornada pendiente para volver al estado normal.'
          : 'Tu entrada ya está registrada. Cerrá la jornada con tu salida.',
        disabled: false,
      };
    }

    if (controlMode === CONTROL_MODE.COMPLETED) {
      return {
        label: 'Jornada completada',
        helper: 'Ya registraste entrada y salida para hoy.',
        disabled: true,
      };
    }

    if (
      controlMode === CONTROL_MODE.VALID ||
      controlMode === CONTROL_MODE.REMOTE
    ) {
      return {
        label: 'Registrar entrada del dia',
        helper:
          controlMode === CONTROL_MODE.REMOTE
            ? 'Vas a registrar tu entrada en modo remoto.'
            : 'Tu ubicación ya fue validada. Registrá la entrada ahora.',
        disabled: false,
      };
    }

    return {
      label: 'Validá o elegí remoto',
      helper: 'Primero validá tu ubicación o elegí trabajo remoto.',
      disabled: true,
    };
  }, [controlMode, isCrossDateOpenShift]);

  const overtimeTitle = openShiftRecord
    ? formatOvertimeTitle(openShiftRecord, currentTimezone)
    : '';

  const overtimeStandardCloseAt = openShiftRecord
    ? getStandardCloseAt(openShiftRecord)
    : null;

  const onCloseWithCurrentTime = useCallback(async () => {
    if (!openShiftRecord) {
      return;
    }

    await submitClockOut({ attendanceId: openShiftRecord.recordId });
  }, [openShiftRecord, submitClockOut]);

  const onCloseAtStandardTime = useCallback(async () => {
    if (!openShiftRecord || !overtimeStandardCloseAt) {
      return;
    }

    await submitClockOut({
      attendanceId: openShiftRecord.recordId,
      autoClosed: true,
      customCloseAt: overtimeStandardCloseAt.toISOString(),
    });
  }, [openShiftRecord, overtimeStandardCloseAt, submitClockOut]);

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
      <AppHeader />

      <GlassCard style={styles.heroCard}>
        <Chip
          label={proximityStatus.chipLabel}
          selected={controlMode !== CONTROL_MODE.VALIDATING}
          style={styles.statusChip}
          tone={proximityStatus.chipTone}
        />
        <ThemedText style={styles.clock} variant="display">
          {formatClock(now, currentTimezone)}
        </ThemedText>
        <ThemedText colorToken="secondary" style={styles.date} variant="body">
          {formatLongDate(now, currentTimezone)}
        </ThemedText>

        <View style={styles.statusContainer}>
          {controlMode === CONTROL_MODE.VALIDATING ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator
                color={theme.colors.brand.primary}
                size="small"
              />
              <ThemedText variant="body">Obteniendo ubicación...</ThemedText>
            </View>
          ) : null}

          <ThemedText
            colorToken={
              controlMode === CONTROL_MODE.VALID ||
              controlMode === CONTROL_MODE.CLOCKED_IN
                ? 'success'
                : controlMode === CONTROL_MODE.OUT_OF_RANGE
                  ? 'warning'
                  : controlMode === CONTROL_MODE.GPS_ERROR
                    ? 'error'
                    : controlMode === CONTROL_MODE.REMOTE
                      ? 'accent'
                      : 'secondary'
            }
            style={styles.helper}
            variant="bodySmall"
          >
            {proximityStatus.helper}
          </ThemedText>

          {isCrossDateOpenShift && openShiftRecord ? (
            <ThemedText
              colorToken="warning"
              style={styles.helper}
              variant="body"
            >
              {`Tenés una jornada abierta del ${formatDisplayDate(openShiftRecord.workDate, currentTimezone)}.`}
            </ThemedText>
          ) : null}

          {controlMode === CONTROL_MODE.IDLE ? (
            <View style={styles.actionButtonsRow}>
              <PrimaryButton
                label="Validar ubicación"
                loading={isSubmitting || isLoadingAttendance}
                onPress={onValidateLocation}
                style={styles.flexButton}
              />
              <SecondaryButton
                label="Trabajo Remoto"
                onPress={proximity.selectRemote}
                style={styles.flexButton}
              />
            </View>
          ) : null}

          {controlMode === CONTROL_MODE.OUT_OF_RANGE ||
          controlMode === CONTROL_MODE.GPS_ERROR ? (
            <View style={styles.actionButtonsRow}>
              <PrimaryButton
                label="Reintentar"
                loading={isSubmitting || isLoadingAttendance}
                onPress={onValidateLocation}
                style={styles.flexButton}
              />
              <SecondaryButton
                label="Trabajo Remoto"
                onPress={proximity.selectRemote}
                style={styles.flexButton}
              />
            </View>
          ) : null}
        </View>

        {controlMode === CONTROL_MODE.VALID ||
        controlMode === CONTROL_MODE.REMOTE ? (
          <>
            <PrimaryButton
              disabled={buttonState.disabled}
              label={buttonState.label}
              loading={isSubmitting || isLoadingAttendance}
              onPress={onRegisterAction}
            />
            <SecondaryButton label="← Volver" onPress={proximity.reset} />
            <ThemedText
              colorToken="secondary"
              style={styles.helper}
              variant="bodySmall"
            >
              {buttonState.helper}
            </ThemedText>
          </>
        ) : null}

        {controlMode === CONTROL_MODE.CLOCKED_IN ||
        controlMode === CONTROL_MODE.COMPLETED ? (
          <>
            <PrimaryButton
              disabled={buttonState.disabled}
              label={buttonState.label}
              loading={isSubmitting || isLoadingAttendance}
              onPress={onRegisterAction}
            />
            <ThemedText
              colorToken="secondary"
              style={styles.helper}
              variant="bodySmall"
            >
              {buttonState.helper}
            </ThemedText>
          </>
        ) : null}

        {errorMessage ? (
          <FeedbackText tone="error">{errorMessage}</FeedbackText>
        ) : null}
      </GlassCard>

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

      <GlassCard style={styles.historyCard} variant="soft">
        <SectionHeader
          actionLabel="Ver todo"
          actionProps={{
            onPress: () => router.push('/(tabs)/control-history' as never),
          }}
          title="Historial reciente"
        />

        {recentEvents.length === 0 ? (
          <ThemedText colorToken="secondary" variant="bodySmall">
            Todavía no hay registros.
          </ThemedText>
        ) : (
          recentEvents.map((event) => (
            <View key={event.id} style={styles.historyRow}>
              <View
                style={[
                  styles.historyIcon,
                  {
                    backgroundColor:
                      event.type === 'clock_in'
                        ? theme.surface.glass.tint
                        : theme.surface.glass.soft,
                    borderColor: theme.surface.glass.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.historyIconDot,
                    {
                      backgroundColor:
                        event.type === 'clock_in'
                          ? theme.colors.status.success
                          : theme.colors.brand.accent,
                    },
                  ]}
                />
              </View>

              <View style={styles.historyInfo}>
                <ThemedText variant="subtitle">
                  {event.type === 'clock_in' ? 'Entrada' : 'Salida'}
                </ThemedText>
                <ThemedText colorToken="secondary" variant="bodySmall">
                  {formatCompactDate(event.occurredAt, currentTimezone)}
                </ThemedText>
              </View>

              <ThemedText colorToken="secondary" variant="label">
                {formatTime(event.occurredAt, currentTimezone)}
              </ThemedText>
            </View>
          ))
        )}
      </GlassCard>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsOvertimeModalVisible(false)}
        transparent
        visible={isOvertimeModalVisible}
      >
        <View
          style={[styles.modalRoot, { backgroundColor: theme.overlay.modal }]}
        >
          <Pressable
            onPress={() => setIsOvertimeModalVisible(false)}
            style={styles.modalBackdrop}
          />

          <GlassCard style={styles.modalCard}>
            <SectionHeader
              subtitle={overtimeTitle}
              title="Tu jornada habitual ya terminó"
            />

            <ThemedText
              colorToken="secondary"
              style={styles.modalBody}
              variant="bodySmall"
            >
              Si te olvidaste de marcar la salida, podés cerrarla con la hora
              actual o con el horario habitual calculado.
            </ThemedText>

            <PrimaryButton
              label="Cerrar con hora actual"
              loading={isSubmitting}
              onPress={onCloseWithCurrentTime}
            />
            <SecondaryButton
              label={`Cerrar jornada habitual (${overtimeStandardCloseAt ? formatTime(overtimeStandardCloseAt.toISOString(), currentTimezone) : '--:--'})`}
              loading={isSubmitting}
              onPress={onCloseAtStandardTime}
            />
          </GlassCard>
        </View>
      </Modal>
    </Screen>
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

function FeedbackText({ children, tone }: { children: string; tone: 'error' }) {
  return (
    <ThemedText
      colorToken={tone === 'error' ? 'error' : 'secondary'}
      style={styles.feedbackText}
      variant="bodySmall"
    >
      {children}
    </ThemedText>
  );
}

function getBlockedMessage(
  reason?: 'gps_accuracy' | 'permission_denied' | 'location_unavailable',
) {
  switch (reason) {
    case 'gps_accuracy':
      return 'Señal GPS débil. Intentá moverte a un lugar abierto.';
    case 'permission_denied':
      return 'Necesitamos acceso a tu ubicación para validar tu zona de trabajo.';
    case 'location_unavailable':
    default:
      return 'No se pudo obtener tu ubicación. Intentá de nuevo.';
  }
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

function formatDisplayDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatHoursLabel(value: number) {
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function formatOvertimeTitle(record: OpenShift, timezone: string) {
  return `Entrada: ${formatTime(record.clockInAt, timezone)} — Jornada: ${formatHoursLabel(record.shiftDurationHours)}h + ${formatHoursLabel(record.breakDurationHours)}h colación`;
}

function getStandardCloseAt(record: OpenShift) {
  return new Date(
    new Date(record.clockInAt).getTime() +
      (record.shiftDurationHours + record.breakDurationHours) * 3_600_000,
  );
}

function getOvertimeThreshold(record: OpenShift) {
  return new Date(
    new Date(record.clockInAt).getTime() +
      (record.shiftDurationHours + record.breakDurationHours + 1) * 3_600_000,
  );
}

function isOvertimeThresholdExceeded(record: OpenShift) {
  return Date.now() > getOvertimeThreshold(record).getTime();
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

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 720,
    paddingHorizontal: 16,
    width: '100%',
  },
  loaderContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  heroCard: {
    alignItems: 'center',
    gap: 12,
  },
  clock: {
    textAlign: 'center',
  },
  date: {
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  helper: {
    textAlign: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  feedbackText: {
    textAlign: 'center',
  },
  statusChip: {
    alignSelf: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  flexButton: {
    flex: 1,
  },
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
  metricIcon: {
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    width: 36,
  },
  metricValue: {
    letterSpacing: -0.4,
  },
  historyCard: {
    gap: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBody: {
    textAlign: 'left',
  },
  modalCard: {
    gap: 12,
    maxWidth: 520,
    width: '100%',
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  historyIcon: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  historyIconDot: {
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
});
