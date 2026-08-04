import {
  CONTROL_MODE,
  type ControlMode,
  resolveButtonState,
  resolveControlMode,
  resolveProximityStatus,
} from '@/components/control/control-model';
import type { ProximityState } from '@/hooks/use-proximity-validation';
import type { OpenShift } from '@/lib/attendance';

function makeOpenShift(overrides: Partial<OpenShift> = {}): OpenShift {
  return {
    recordId: 'record-1',
    workDate: '2026-08-03',
    clockInAt: '2026-08-03T09:00:00.000Z',
    officeId: 'office-1',
    officeName: 'Oficina Central',
    officeIsRemote: false,
    shiftDurationHours: 8,
    breakDurationHours: 0.75,
    ...overrides,
  };
}

function makeProximityState(
  overrides: Partial<ProximityState> = {},
): ProximityState {
  return { status: 'idle', location: null, ...overrides };
}

describe('resolveControlMode', () => {
  it('prioritizes an active clock-in over a completed day and proximity', () => {
    expect(
      resolveControlMode({
        hasActiveClockIn: true,
        hasCompletedDay: true,
        proximityStatus: 'remote',
      }),
    ).toBe(CONTROL_MODE.CLOCKED_IN);
  });

  it('marks the day completed when both stamps exist', () => {
    expect(
      resolveControlMode({
        hasActiveClockIn: false,
        hasCompletedDay: true,
        proximityStatus: 'valid',
      }),
    ).toBe(CONTROL_MODE.COMPLETED);
  });

  it('maps every proximity status to its control mode', () => {
    const statuses: Array<[ProximityState['status'], ControlMode]> = [
      ['loading', CONTROL_MODE.VALIDATING],
      ['valid', CONTROL_MODE.VALID],
      ['out_of_range', CONTROL_MODE.OUT_OF_RANGE],
      ['blocked', CONTROL_MODE.GPS_ERROR],
      ['remote', CONTROL_MODE.REMOTE],
      ['idle', CONTROL_MODE.IDLE],
    ];

    for (const [proximityStatus, expected] of statuses) {
      expect(
        resolveControlMode({
          hasActiveClockIn: false,
          hasCompletedDay: false,
          proximityStatus,
        }),
      ).toBe(expected);
    }
  });
});

describe('resolveProximityStatus', () => {
  it('describes a validated location with its office', () => {
    const status = resolveProximityStatus({
      controlMode: CONTROL_MODE.VALID,
      proximityState: makeProximityState({
        status: 'valid',
        officeName: 'Torre Norte',
      }),
      isCrossDateOpenShift: false,
      openShiftRecord: null,
    });

    expect(status).toEqual({
      chipLabel: 'Ubicación validada',
      chipTone: 'success',
      helper: 'Validado: Torre Norte',
    });
  });

  it('falls back to the GPS blocked message when no error message exists', () => {
    const status = resolveProximityStatus({
      controlMode: CONTROL_MODE.GPS_ERROR,
      proximityState: makeProximityState({
        status: 'blocked',
        errorReason: 'permission_denied',
      }),
      isCrossDateOpenShift: false,
      openShiftRecord: null,
    });

    expect(status.chipLabel).toBe('Error de GPS');
    expect(status.chipTone).toBe('danger');
    expect(status.helper).toContain('ubicación');
  });

  it('flags a pending cross-date shift', () => {
    const status = resolveProximityStatus({
      controlMode: CONTROL_MODE.CLOCKED_IN,
      proximityState: makeProximityState({ status: 'idle' }),
      isCrossDateOpenShift: true,
      openShiftRecord: makeOpenShift(),
    });

    expect(status).toEqual({
      chipLabel: 'Jornada pendiente',
      chipTone: 'warning',
      helper: 'Validado: Oficina Central',
    });
  });

  it('reports a remote active shift', () => {
    const status = resolveProximityStatus({
      controlMode: CONTROL_MODE.CLOCKED_IN,
      proximityState: makeProximityState({ status: 'idle' }),
      isCrossDateOpenShift: false,
      openShiftRecord: makeOpenShift({
        officeIsRemote: true,
        officeName: 'Casa',
      }),
    });

    expect(status.helper).toBe('Remoto');
  });

  it('keeps neutral copy for an idle screen', () => {
    const status = resolveProximityStatus({
      controlMode: CONTROL_MODE.IDLE,
      proximityState: makeProximityState({ status: 'idle' }),
      isCrossDateOpenShift: false,
      openShiftRecord: null,
    });

    expect(status).toEqual({
      chipLabel: 'Sin validar',
      chipTone: 'neutral',
      helper: 'Validá tu ubicación antes de registrar la entrada.',
    });
  });
});

describe('resolveButtonState', () => {
  it('offers closing a pending cross-date shift first', () => {
    expect(
      resolveButtonState({
        controlMode: CONTROL_MODE.CLOCKED_IN,
        isCrossDateOpenShift: true,
      }),
    ).toMatchObject({
      label: 'Registrar salida de la jornada pendiente',
      disabled: false,
    });
  });

  it('disables registration for a completed day', () => {
    expect(
      resolveButtonState({
        controlMode: CONTROL_MODE.COMPLETED,
        isCrossDateOpenShift: false,
      }),
    ).toMatchObject({ label: 'Jornada completada', disabled: true });
  });

  it('enables clock-in only after validation or remote mode', () => {
    expect(
      resolveButtonState({
        controlMode: CONTROL_MODE.VALID,
        isCrossDateOpenShift: false,
      }),
    ).toMatchObject({ label: 'Registrar entrada del dia', disabled: false });

    expect(
      resolveButtonState({
        controlMode: CONTROL_MODE.REMOTE,
        isCrossDateOpenShift: false,
      }),
    ).toMatchObject({ helper: 'Vas a registrar tu entrada en modo remoto.' });

    expect(
      resolveButtonState({
        controlMode: CONTROL_MODE.IDLE,
        isCrossDateOpenShift: false,
      }),
    ).toMatchObject({ label: 'Validá o elegí remoto', disabled: true });
  });
});
