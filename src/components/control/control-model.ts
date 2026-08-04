import type { ProximityState } from '@/hooks/use-proximity-validation';
import type { OpenShift } from '@/lib/attendance';
import { getBlockedMessage } from './format';

export const CONTROL_MODE = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  VALID: 'valid',
  OUT_OF_RANGE: 'out_of_range',
  GPS_ERROR: 'gps_error',
  REMOTE: 'remote',
  CLOCKED_IN: 'clocked_in',
  COMPLETED: 'completed',
} as const;

export type ControlMode = (typeof CONTROL_MODE)[keyof typeof CONTROL_MODE];

export type ControlStatusViewModel = {
  chipLabel: string;
  chipTone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  helper?: string;
};

export type ControlButtonState = {
  disabled: boolean;
  helper: string;
  label: string;
};

export interface ResolveControlModeInput {
  hasActiveClockIn: boolean;
  hasCompletedDay: boolean;
  proximityStatus: ProximityState['status'];
}

export function resolveControlMode({
  hasActiveClockIn,
  hasCompletedDay,
  proximityStatus,
}: ResolveControlModeInput): ControlMode {
  if (hasActiveClockIn) {
    return CONTROL_MODE.CLOCKED_IN;
  }

  if (hasCompletedDay) {
    return CONTROL_MODE.COMPLETED;
  }

  switch (proximityStatus) {
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
}

export interface ResolveProximityStatusInput {
  controlMode: ControlMode;
  proximityState: ProximityState;
  isCrossDateOpenShift: boolean;
  openShiftRecord: OpenShift | null;
}

export function resolveProximityStatus({
  controlMode,
  proximityState,
  isCrossDateOpenShift,
  openShiftRecord,
}: ResolveProximityStatusInput): ControlStatusViewModel {
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
        helper: proximityState.officeName
          ? `Validado: ${proximityState.officeName}`
          : 'Ubicación validada.',
      };
    }
    case CONTROL_MODE.OUT_OF_RANGE:
      return {
        chipLabel: 'Fuera de rango',
        chipTone: 'warning' as const,
        helper: 'Fuera de rango. Reintentá o registrate como remoto.',
      };
    case CONTROL_MODE.GPS_ERROR:
      return {
        chipLabel: 'Error de GPS',
        chipTone: 'danger' as const,
        helper:
          proximityState.errorMessage ??
          getBlockedMessage(proximityState.errorReason),
      };
    case CONTROL_MODE.REMOTE:
      return {
        chipLabel: 'Trabajo Remoto',
        chipTone: 'brand' as const,
        helper: 'Remoto',
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
          ? 'Remoto'
          : openShiftRecord?.officeName
            ? `Validado: ${openShiftRecord.officeName}`
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
}

export interface ResolveButtonStateInput {
  controlMode: ControlMode;
  isCrossDateOpenShift: boolean;
}

export function resolveButtonState({
  controlMode,
  isCrossDateOpenShift,
}: ResolveButtonStateInput): ControlButtonState {
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
      helper: '',
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
}
