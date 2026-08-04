import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  CONTROL_MODE,
  resolveButtonState,
  resolveControlMode,
  resolveProximityStatus,
} from '@/components/control/control-model';
import {
  buildRecentHistoryItems,
  formatOvertimeTitle,
  getStandardCloseAt,
  isOvertimeThresholdExceeded,
  type RecentHistoryItem,
} from '@/components/control/format';
import {
  ControlHeroCard,
  HeroCardSkeleton,
} from '@/components/control/hero-card';
import { MetricsSkeleton, WeeklyMetrics } from '@/components/control/metrics';
import { OvertimeActionsModal } from '@/components/control/overtime-modal';
import {
  HistorySkeleton,
  RecentHistoryCard,
} from '@/components/control/recent-history';
import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { BottomTabInset } from '@/constants/theme';
import { useAttendanceFocusRefresh } from '@/hooks/use-attendance-refresh';
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
import { useFeedback } from '@/theme/feedback';
import { Screen, ThemedText } from '@/theme/primitives';

const VALIDATION_TIMEOUT_MS = 5 * 60 * 1000;

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
  const feedback = useFeedback();

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

  const hasLoadedAttendanceRef = useRef(false);

  const loadAttendance = useCallback(async () => {
    if (!activeOrganization) return;

    hasLoadedAttendanceRef.current = true;
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

  const { refresh: refreshAttendance } = useAttendanceFocusRefresh({
    refresh: loadAttendance,
  });

  useEffect(() => {
    if (!activeOrganization || hasLoadedAttendanceRef.current) {
      return;
    }

    void refreshAttendance();
  }, [activeOrganization, refreshAttendance]);

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

      await refreshAttendance();
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
    openShiftRecord,
    proximity,
    refreshAttendance,
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
      await refreshAttendance();
      proximity.reset();
    } catch (error) {
      const detail =
        getErrorMessage(error) ?? 'Ocurrió un problema inesperado.';
      feedback.show({
        tone: 'error',
        title: 'No se pudo cerrar la jornada',
        message: `No pudimos cerrar la jornada con la hora actual (${detail}).`,
        durationMs: 0,
      });
    }
  }, [feedback, openShiftRecord, proximity, refreshAttendance, submitClockOut]);

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
      await refreshAttendance();
      proximity.reset();
    } catch (error) {
      const detail =
        getErrorMessage(error) ?? 'Ocurrió un problema inesperado.';
      feedback.show({
        tone: 'error',
        title: 'No se pudo cerrar la jornada',
        message: `No pudimos cerrar la jornada con el horario habitual (${detail}).`,
        durationMs: 0,
      });
    }
  }, [
    feedback,
    openShiftRecord,
    overtimeStandardCloseAt,
    proximity,
    refreshAttendance,
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
        visible={isOvertimeModalVisible}
      />
    </Screen>
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
});
