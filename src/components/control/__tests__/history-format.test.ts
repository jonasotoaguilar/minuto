import {
  type AttendancePeriod,
  EMPTY_SUMMARY,
  formatAttendanceMonthLabel,
  formatWeeklyHours,
  formatWorkdayLabel,
  getAdjacentPeriod,
  getCurrentAttendancePeriod,
  getTodayDateString,
  type HistoryDisplayRow,
  resolveJourneyStatusLabel,
} from '@/components/control/history-format';

const SANTIAGO = 'America/Santiago';

function makeRow(
  overrides: Partial<HistoryDisplayRow> = {},
): HistoryDisplayRow {
  return {
    key: 'row-1',
    workDate: '2026-08-03',
    hasRecord: true,
    clockInAt: '2026-08-03T09:00:00.000Z',
    clockOutAt: '2026-08-03T18:00:00.000Z',
    status: 'complete',
    workedMinutes: 480,
    ...overrides,
  };
}

describe('resolveJourneyStatusLabel', () => {
  it('labels an absence, an auto-close and both completion states', () => {
    expect(resolveJourneyStatusLabel(makeRow({ hasRecord: false }))).toBe(
      'Ausencia',
    );
    expect(
      resolveJourneyStatusLabel(
        makeRow({ status: 'auto_closed', hasRecord: true }),
      ),
    ).toBe('Cierre automático');
    expect(resolveJourneyStatusLabel(makeRow({ status: 'complete' }))).toBe(
      'Jornada completa',
    );
    expect(resolveJourneyStatusLabel(makeRow({ status: 'incomplete' }))).toBe(
      'Jornada incompleta',
    );
  });
});

describe('formatWorkdayLabel', () => {
  it('extracts the weekday and day from a work date', () => {
    const label = formatWorkdayLabel('2026-08-03', SANTIAGO);

    expect(label.weekday).toBe('LUN');
    expect(label.day).toBe('03');
  });
});

describe('formatAttendanceMonthLabel', () => {
  it('renders the month and year in Spanish', () => {
    expect(formatAttendanceMonthLabel(2026, 8)).toBe('agosto de 2026');
  });
});

describe('formatWeeklyHours', () => {
  it('formats integer and fractional hours', () => {
    expect(formatWeeklyHours(40)).toBe('40');
    expect(formatWeeklyHours(37.5)).toBe('37,5');
  });

  it('clamps negatives to zero and falls back to 40 for non-finite input', () => {
    expect(formatWeeklyHours(-5)).toBe('0');
    expect(formatWeeklyHours(Number.NaN)).toBe('40');
  });
});

describe('getCurrentAttendancePeriod', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves the current year and month in the target timezone', () => {
    jest.setSystemTime(new Date('2026-08-03T12:00:00.000Z'));

    expect(getCurrentAttendancePeriod(SANTIAGO)).toEqual({
      year: 2026,
      month: 8,
    });
    expect(getCurrentAttendancePeriod('UTC')).toEqual({
      year: 2026,
      month: 8,
    });
  });
});

describe('getTodayDateString', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the calendar date in the target timezone', () => {
    jest.setSystemTime(new Date('2026-08-03T23:30:00.000Z'));

    expect(getTodayDateString(SANTIAGO)).toBe('2026-08-03');
    expect(getTodayDateString('UTC')).toBe('2026-08-03');
  });
});

describe('getAdjacentPeriod', () => {
  const periods: AttendancePeriod[] = [
    { year: 2026, month: 5 },
    { year: 2026, month: 8 },
    { year: 2026, month: 11 },
  ];

  it('finds the closest previous and next period', () => {
    const current: AttendancePeriod = { year: 2026, month: 8 };

    expect(
      getAdjacentPeriod({ periods, current, direction: 'previous' }),
    ).toEqual({ year: 2026, month: 5 });
    expect(getAdjacentPeriod({ periods, current, direction: 'next' })).toEqual({
      year: 2026,
      month: 11,
    });
  });

  it('returns null at either boundary', () => {
    const first: AttendancePeriod = { year: 2026, month: 5 };
    const last: AttendancePeriod = { year: 2026, month: 11 };

    expect(
      getAdjacentPeriod({ periods, current: first, direction: 'previous' }),
    ).toBeNull();
    expect(
      getAdjacentPeriod({ periods, current: last, direction: 'next' }),
    ).toBeNull();
  });
});

describe('EMPTY_SUMMARY', () => {
  it('defines the neutral summary defaults', () => {
    expect(EMPTY_SUMMARY).toEqual({
      weeklyHours: 40,
      workedDays: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
    });
  });
});
