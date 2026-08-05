import type { AttendanceHistoryPageItem } from '@/lib/attendance';

export type AttendancePeriod = {
  year: number;
  month: number;
};

export type HistoryDisplayRow = {
  key: string;
  workDate: string;
  hasRecord: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  status: AttendanceHistoryPageItem['status'];
  workedMinutes: number;
};

export type HistorySummary = {
  weeklyHours: number;
  workedDays: number;
  totalMinutes: number;
  overtimeMinutes: number;
};

export const EMPTY_SUMMARY: HistorySummary = {
  weeklyHours: 40,
  workedDays: 0,
  totalMinutes: 0,
  overtimeMinutes: 0,
};

export function resolveJourneyStatusLabel(row: HistoryDisplayRow) {
  if (!row.hasRecord) {
    return 'Ausencia';
  }

  if (row.status === 'auto_closed') {
    return 'Cierre automático';
  }

  return row.status === 'complete' ? 'Jornada completa' : 'Jornada incompleta';
}

export function formatWorkdayLabel(workDate: string, timezone: string) {
  const [yearPart, monthPart, dayPart] = workDate.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const dayNumber = Number(dayPart);

  const date =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(dayNumber)
      ? new Date(Date.UTC(year, month - 1, dayNumber, 12, 0, 0))
      : new Date(`${workDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
  }).formatToParts(date);

  const weekday =
    parts
      .find((part) => part.type === 'weekday')
      ?.value.replace('.', '')
      .toUpperCase() ?? '---';
  const day = parts.find((part) => part.type === 'day')?.value ?? '--';

  return {
    weekday,
    day,
  };
}

export function formatAttendanceMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatWeeklyHours(weeklyHours: number) {
  const safeWeeklyHours = Number.isFinite(weeklyHours)
    ? Math.max(0, weeklyHours)
    : 40;

  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: Number.isInteger(safeWeeklyHours) ? 0 : 1,
    minimumFractionDigits: 0,
  }).format(safeWeeklyHours);
}

export function getCurrentAttendancePeriod(timezone: string): AttendancePeriod {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  if (Number.isInteger(year) && Number.isInteger(month)) {
    return { year, month };
  }

  const now = new Date();

  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

export function getTodayDateString(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (year && month && day) {
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().slice(0, 10);
}

export function getAdjacentPeriod(params: {
  periods: AttendancePeriod[];
  current: AttendancePeriod;
  direction: 'previous' | 'next';
}): AttendancePeriod | null {
  const currentValue = params.current.year * 100 + params.current.month;

  if (params.direction === 'previous') {
    const previous = [...params.periods]
      .filter((period) => period.year * 100 + period.month < currentValue)
      .sort(
        (left, right) =>
          right.year * 100 + right.month - (left.year * 100 + left.month),
      )[0];

    return previous ?? null;
  }

  const next = [...params.periods]
    .filter((period) => period.year * 100 + period.month > currentValue)
    .sort(
      (left, right) =>
        left.year * 100 + left.month - (right.year * 100 + right.month),
    )[0];

  return next ?? null;
}
