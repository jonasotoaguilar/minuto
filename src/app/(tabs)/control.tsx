import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  CONTROL_MODE,
  type ControlButtonState,
  type ControlMode,
  type ControlStatusViewModel,
  resolveButtonState,
  resolveControlMode,
  resolveProximityStatus,
} from '@/components/control/control-model';
import {
  buildRecentHistoryItems,
  formatCompactDate,
  formatDisplayDate,
  formatOvertimeTitle,
  formatTime,
  getStandardCloseAt,
  isOvertimeThresholdExceeded,
  type RecentHistoryItem,
} from '@/components/control/format';
import {
  ControlHeroCard,
  HeroCardSkeleton,
} from '@/components/control/hero-card';
import { MetricsSkeleton, WeeklyMetrics } from '@/components/control/metrics';
import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useProximityValidation } from '@/hooks/use-proximity-validation';
import { useTheme } from '@/hooks/use-theme';
import {
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
import { getErrorMessage } from '@/lib/error';
import { resolveOrganizationTimezone } from '@/lib/timezone';
import {
  AttendanceIcon,
  GlassCard,
  ModalCard,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  Skeleton,
  ThemedText,
} from '@/theme/primitives';

const VALIDATION_TIMEOUT_MS = 5 * 60 * 1000;

type AppTheme = ReturnType<typeof useTheme>;

export default function ControlScreen() {
  const router = useRouter();
  const isScreenFocused = useIsFocused();
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

  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [openShiftRecord, setOpenShiftRecord] = useState<OpenShift | null>(
    null,
  );
  const [isOvertimeModalVisible, setIsOvertimeModalVisible] = useState(false);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyAttendedDays, setWeeklyAttendedDays] = useState(0);
  const [recentEvents, setRecentEvents] = useState<RecentHistoryItem[]>([]);
  const [isOvertimeAutoDismissed, setIsOvertimeAutoDismissed] = useState(false);

  const loadAttendance = useCallback(async () => {
    if (!activeOrganization) return;

    setIsLoadingAttendance(true);
    setErrorMessage('');

    const currentDate = getOrganizationToday(currentTimezone);
    const week = getOrganizationWeekRange(currentTimezone);

    try {
      const [today, weeklyRecords, recentRecords, openShift] =
        await Promise.all([
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
            eventLimit: 6,
          }),
          getOpenShift(activeOrganization.membershipId),
        ]);

      const totals = calculateWeeklyTotals(weeklyRecords, {
        includeOpenShiftMinutes: true,
        now: new Date(),
      });

      setTodayRecord(today);
      setOpenShiftRecord(openShift);
      setWeeklyMinutes(totals.totalMinutes);
      setWeeklyAttendedDays(totals.attendedDays);
      setRecentEvents(buildRecentHistoryItems(recentRecords));
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

  const controlMode = useMemo(
    () =>
      resolveControlMode({
        hasActiveClockIn,
        hasCompletedDay,
        proximityStatus: proximity.state.status,
      }),
    [hasActiveClockIn, hasCompletedDay, proximity.state.status],
  );

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
    if (!isScreenFocused) {
      setIsOvertimeModalVisible(false);
      setIsOvertimeAutoDismissed(false);
      return;
    }

    if (!openShiftRecord) {
      setIsOvertimeModalVisible(false);
      setIsOvertimeAutoDismissed(false);
      return;
    }

    const syncOvertimeVisibility = () => {
      const isExceeded = isOvertimeThresholdExceeded(openShiftRecord);

      if (!isExceeded) {
        setIsOvertimeAutoDismissed(false);
        setIsOvertimeModalVisible(false);
        return;
      }

      if (!isOvertimeAutoDismissed) {
        setIsOvertimeModalVisible(true);
      }
    };

    syncOvertimeVisibility();

    const intervalId = setInterval(syncOvertimeVisibility, 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOvertimeAutoDismissed, isScreenFocused, openShiftRecord]);

  const dismissOvertimeModal = useCallback(() => {
    setIsOvertimeModalVisible(false);
    setIsOvertimeAutoDismissed(true);
  }, []);

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
      setIsOvertimeAutoDismissed(false);
    },
    [],
  );

  const onRegisterAction = useCallback(async () => {
    if (!activeOrganization) {
      return;
    }

    if (openShiftRecord && isOvertimeThresholdExceeded(openShiftRecord)) {
      setIsOvertimeAutoDismissed(false);
      setIsOvertimeModalVisible(true);
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

  const proximityStatus = useMemo(
    () =>
      resolveProximityStatus({
        controlMode,
        proximityState: proximity.state,
        isCrossDateOpenShift,
        openShiftRecord,
      }),
    [controlMode, isCrossDateOpenShift, openShiftRecord, proximity.state],
  );

  const buttonState = useMemo(
    () => resolveButtonState({ controlMode, isCrossDateOpenShift }),
    [controlMode, isCrossDateOpenShift],
  );

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

    try {
      await submitClockOut({ attendanceId: openShiftRecord.recordId });
      await loadAttendance();
      proximity.reset();
    } catch (error) {
      const detail =
        getErrorMessage(error) ?? 'Ocurrió un problema inesperado.';
      Alert.alert(
        'No se pudo cerrar la jornada',
        `No pudimos cerrar la jornada con la hora actual (${detail}).`,
      );
    }
  }, [loadAttendance, openShiftRecord, proximity, submitClockOut]);

  const onCloseAtStandardTime = useCallback(async () => {
    if (!openShiftRecord || !overtimeStandardCloseAt) {
      return;
    }

    try {
      await submitClockOut({
        attendanceId: openShiftRecord.recordId,
        autoClosed: true,
        customCloseAt: overtimeStandardCloseAt.toISOString(),
      });
      await loadAttendance();
      proximity.reset();
    } catch (error) {
      const detail =
        getErrorMessage(error) ?? 'Ocurrió un problema inesperado.';
      Alert.alert(
        'No se pudo cerrar la jornada',
        `No pudimos cerrar la jornada con el horario habitual (${detail}).`,
      );
    }
  }, [
    loadAttendance,
    openShiftRecord,
    overtimeStandardCloseAt,
    proximity,
    submitClockOut,
  ]);

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

      {isLoadingAttendance ? (
        <HeroCardSkeleton />
      ) : (
        <ControlHeroCard
          buttonState={buttonState}
          controlMode={controlMode}
          currentTimezone={currentTimezone}
          errorMessage={errorMessage}
          isCrossDateOpenShift={isCrossDateOpenShift}
          isSubmitting={isSubmitting}
          onRegisterAction={onRegisterAction}
          onResetValidation={proximity.reset}
          onSelectRemote={proximity.selectRemote}
          onValidateLocation={onValidateLocation}
          openShiftRecord={openShiftRecord}
          proximityStatus={proximityStatus}
        />
      )}

      {isLoadingAttendance ? (
        <MetricsSkeleton />
      ) : (
        <WeeklyMetrics
          weeklyAttendedDays={weeklyAttendedDays}
          weeklyMinutes={weeklyMinutes}
        />
      )}

      {isLoadingAttendance ? (
        <HistorySkeleton />
      ) : (
        <RecentHistoryCard
          currentTimezone={currentTimezone}
          onPressViewAll={() => router.push('/(tabs)/control-history' as never)}
          recentEvents={recentEvents}
          theme={theme}
        />
      )}

      <OvertimeActionsModal
        currentTimezone={currentTimezone}
        isSubmitting={isSubmitting}
        onCloseAtStandardTime={onCloseAtStandardTime}
        onCloseWithCurrentTime={onCloseWithCurrentTime}
        onDismiss={dismissOvertimeModal}
        overtimeStandardCloseAt={overtimeStandardCloseAt}
        overtimeTitle={overtimeTitle}
        theme={theme}
        visible={isOvertimeModalVisible}
      />
    </Screen>
  );
}

type RecentHistoryCardProps = {
  currentTimezone: string;
  onPressViewAll: () => void;
  recentEvents: RecentHistoryItem[];
  theme: AppTheme;
};

function RecentHistoryCard({
  currentTimezone,
  onPressViewAll,
  recentEvents,
  theme,
}: RecentHistoryCardProps) {
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

type OvertimeActionsModalProps = {
  currentTimezone: string;
  isSubmitting: boolean;
  onCloseAtStandardTime: () => void;
  onCloseWithCurrentTime: () => void;
  onDismiss: () => void;
  overtimeStandardCloseAt: Date | null;
  overtimeTitle: string;
  theme: AppTheme;
  visible: boolean;
};

function OvertimeActionsModal({
  currentTimezone,
  isSubmitting,
  onCloseAtStandardTime,
  onCloseWithCurrentTime,
  onDismiss,
  overtimeStandardCloseAt,
  overtimeTitle,
  visible,
}: OvertimeActionsModalProps) {
  return (
    <ModalCard
      visible={visible}
      onDismiss={onDismiss}
      title="Tu jornada habitual ya terminó"
      subtitle={overtimeTitle}
    >
      <ThemedText
        colorToken="secondary"
        style={styles.modalBody}
        variant="bodySmall"
      >
        Si te olvidaste de marcar la salida, podés cerrarla con la hora actual o
        con el horario habitual calculado.
      </ThemedText>

      <PrimaryButton
        label="Cerrar con hora actual"
        loading={isSubmitting}
        onPress={onCloseWithCurrentTime}
      />
      <SecondaryButton
        label={`Cerrar con jornada habitual (${overtimeStandardCloseAt ? formatTime(overtimeStandardCloseAt.toISOString(), currentTimezone) : '--:--'})`}
        loading={isSubmitting}
        onPress={onCloseAtStandardTime}
      />
    </ModalCard>
  );
}

function HistorySkeleton() {
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

  historyCard: {
    gap: 16,
  },
  modalBody: {
    textAlign: 'left',
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
