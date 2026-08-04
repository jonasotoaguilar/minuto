import {
  buildRecentHistoryItems,
  formatClock,
  formatMinutes,
  formatOvertimeTitle,
  getBlockedMessage,
  getStandardCloseAt,
  isOvertimeThresholdExceeded,
} from '@/components/control/format';
import type { OpenShift } from '@/lib/attendance';

const SANTIAGO = 'America/Santiago';

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

describe('formatClock', () => {
  it('formats an instant as HH:mm:ss in the target timezone', () => {
    const instant = new Date('2026-08-03T15:04:05.000Z');

    expect(formatClock(instant, SANTIAGO)).toBe('11:04:05');
    expect(formatClock(instant, 'UTC')).toBe('15:04:05');
  });
});

describe('formatMinutes', () => {
  it('renders hours and minutes with the h/m suffix', () => {
    expect(formatMinutes(125)).toBe('2h 5m');
    expect(formatMinutes(60)).toBe('1h 0m');
    expect(formatMinutes(0)).toBe('0h 0m');
  });
});

describe('getStandardCloseAt', () => {
  it('adds shift plus break hours to the clock-in instant', () => {
    const record = makeOpenShift();

    expect(getStandardCloseAt(record).toISOString()).toBe(
      '2026-08-03T17:45:00.000Z',
    );
  });
});

describe('isOvertimeThresholdExceeded', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is false before the threshold and true after it', () => {
    const record = makeOpenShift();
    const thresholdAt = new Date('2026-08-03T18:45:00.000Z').getTime() + 1;

    jest.setSystemTime(thresholdAt - 60_000);
    expect(isOvertimeThresholdExceeded(record)).toBe(false);

    jest.setSystemTime(thresholdAt);
    expect(isOvertimeThresholdExceeded(record)).toBe(true);
  });
});

describe('getBlockedMessage', () => {
  it('maps every blocked reason to Spanish copy', () => {
    expect(getBlockedMessage('gps_accuracy')).toContain('GPS');
    expect(getBlockedMessage('permission_denied')).toContain('ubicación');
    expect(getBlockedMessage('location_unavailable')).toContain(
      'No se pudo obtener',
    );
    expect(getBlockedMessage(undefined)).toContain('No se pudo obtener');
  });
});

describe('buildRecentHistoryItems', () => {
  it('maps records to preview items and caps the list at six', () => {
    const records = Array.from({ length: 8 }, (_, index) => ({
      id: `event-${index}`,
      type: (index % 2 === 0 ? 'clock_in' : 'clock_out') as
        | 'clock_in'
        | 'clock_out',
      occurredAt: `2026-08-0${(index % 9) + 1}T10:00:00.000Z`,
      workDate: `2026-08-0${(index % 9) + 1}`,
      officeName: `Sucursal ${index}`,
      officeIsRemote: false,
    }));

    const items = buildRecentHistoryItems(records);

    expect(items).toHaveLength(6);
    expect(items[0]).toMatchObject({
      id: 'event-0',
      type: 'clock_in',
      officeName: 'Sucursal 0',
      officeIsRemote: false,
    });
  });

  it('labels remote records and unnamed offices', () => {
    const items = buildRecentHistoryItems([
      {
        id: 'remote',
        type: 'clock_out',
        occurredAt: '2026-08-03T18:00:00.000Z',
        workDate: '2026-08-03',
        officeName: 'Casa',
        officeIsRemote: true,
      },
      {
        id: 'unnamed',
        type: 'clock_in',
        occurredAt: '2026-08-03T09:00:00.000Z',
        workDate: '2026-08-03',
        officeName: '  ',
      },
    ]);

    expect(items[0].officeName).toBe('Remoto');
    expect(items[1].officeName).toBe('Sin sucursal');
  });
});

describe('formatOvertimeTitle', () => {
  it('renders the entry time and shift breakdown', () => {
    const title = formatOvertimeTitle(makeOpenShift(), SANTIAGO);

    expect(title).toContain('Entrada: 05:00');
    expect(title).toContain('Jornada: 8h + 0,75h colación');
  });
});
