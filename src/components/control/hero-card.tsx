import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { OpenShift } from '@/lib/attendance';
import {
  Chip,
  FeedbackBlock,
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  ThemedText,
} from '@/theme/primitives';
import { LiveClock } from './clock';
import {
  CONTROL_MODE,
  type ControlButtonState,
  type ControlMode,
  type ControlStatusViewModel,
} from './control-model';
import { formatDisplayDate } from './format';

export interface ControlHeroCardProps {
  buttonState: ControlButtonState;
  controlMode: ControlMode;
  currentTimezone: string;
  errorMessage: string;
  isCrossDateOpenShift: boolean;
  isSubmitting: boolean;
  onRegisterAction: () => void;
  onResetValidation: () => void;
  onSelectRemote: () => void;
  onValidateLocation: () => void;
  openShiftRecord: OpenShift | null;
  proximityStatus: ControlStatusViewModel;
}

export function ControlHeroCard({
  buttonState,
  controlMode,
  currentTimezone,
  errorMessage,
  isCrossDateOpenShift,
  isSubmitting,
  onRegisterAction,
  onResetValidation,
  onSelectRemote,
  onValidateLocation,
  openShiftRecord,
  proximityStatus,
}: ControlHeroCardProps) {
  const theme = useTheme();
  const helperTone =
    controlMode === CONTROL_MODE.VALID ||
    controlMode === CONTROL_MODE.CLOCKED_IN
      ? 'success'
      : controlMode === CONTROL_MODE.OUT_OF_RANGE
        ? 'warning'
        : controlMode === CONTROL_MODE.GPS_ERROR
          ? 'error'
          : controlMode === CONTROL_MODE.REMOTE
            ? 'accent'
            : 'secondary';

  return (
    <GlassCard style={styles.heroCard}>
      <Chip
        label={proximityStatus.chipLabel}
        selected={controlMode !== CONTROL_MODE.VALIDATING}
        style={styles.statusChip}
        tone={proximityStatus.chipTone}
      />
      <LiveClock currentTimezone={currentTimezone} />

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
          colorToken={helperTone}
          style={styles.helper}
          variant="bodySmall"
        >
          {proximityStatus.helper}
        </ThemedText>

        {isCrossDateOpenShift && openShiftRecord ? (
          <ThemedText colorToken="warning" style={styles.helper} variant="body">
            {`Tenés una jornada abierta del ${formatDisplayDate(openShiftRecord.workDate, currentTimezone)}.`}
          </ThemedText>
        ) : null}

        {controlMode === CONTROL_MODE.IDLE ? (
          <View style={styles.actionButtonsRow}>
            <PrimaryButton
              label="Validar ubicación"
              loading={isSubmitting}
              onPress={onValidateLocation}
              style={styles.flexButton}
            />
            <SecondaryButton
              label="Trabajo Remoto"
              onPress={onSelectRemote}
              style={styles.flexButton}
            />
          </View>
        ) : null}

        {controlMode === CONTROL_MODE.OUT_OF_RANGE ||
        controlMode === CONTROL_MODE.GPS_ERROR ? (
          <View style={styles.actionButtonsRow}>
            <PrimaryButton
              label="Reintentar"
              loading={isSubmitting}
              onPress={onValidateLocation}
              style={styles.flexButton}
            />
            <SecondaryButton
              label="Trabajo Remoto"
              onPress={onSelectRemote}
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
            loading={isSubmitting}
            onPress={onRegisterAction}
          />
          <SecondaryButton label="← Volver" onPress={onResetValidation} />
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
            loading={isSubmitting}
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
        <FeedbackBlock tone="error" message={errorMessage} />
      ) : null}
    </GlassCard>
  );
}

export function HeroCardSkeleton() {
  return (
    <GlassCard style={styles.heroCard}>
      <Skeleton style={styles.skeletonChip} />
      <Skeleton style={styles.skeletonClock} />
      <Skeleton style={styles.skeletonDate} />

      <View style={styles.statusContainer}>
        <Skeleton style={styles.skeletonHelperLineLong} />
        <Skeleton style={styles.skeletonHelperLineShort} />
      </View>

      <View style={styles.actionButtonsRow}>
        <Skeleton style={[styles.skeletonButton, styles.flexButton]} />
        <Skeleton style={[styles.skeletonButton, styles.flexButton]} />
      </View>

      <Skeleton style={styles.skeletonButton} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    gap: 12,
  },
  helper: {
    textAlign: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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
  skeletonChip: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 30,
    width: 148,
  },
  skeletonClock: {
    borderRadius: 16,
    height: 48,
    width: 216,
  },
  skeletonDate: {
    borderRadius: 12,
    height: 22,
    width: 252,
  },
  skeletonHelperLineLong: {
    alignSelf: 'center',
    height: 18,
    width: '82%',
  },
  skeletonHelperLineShort: {
    alignSelf: 'center',
    height: 16,
    width: '62%',
  },
  skeletonButton: {
    borderRadius: 20,
    height: 50,
    width: '100%',
  },
});
