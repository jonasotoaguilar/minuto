import { supabase } from '@/lib/supabase';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type AttendanceRow = {
  id: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_location: AttendanceLocation | null;
  clock_out_location: AttendanceLocation | null;
  created_at: string;
};

export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type AttendanceRecord = {
  id: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  clockInLocation: AttendanceLocation | null;
  clockOutLocation: AttendanceLocation | null;
  createdAt: string;
};

export type AttendanceEvent = {
  id: string;
  type: 'clock_in' | 'clock_out';
  occurredAt: string;
  workDate: string;
};

export type AttendanceTypeFilter = 'all' | 'clock_in' | 'clock_out';

export function getOrganizationToday(timezone: string) {
  return formatDateInTimezone(new Date(), timezone);
}

export function getOrganizationWeekRange(timezone: string) {
  const today = getZonedDate(new Date(), timezone);
  const mondayOffset = (today.weekday + 6) % 7;

  const startDate = new Date(
    today.utcDate.getTime() - mondayOffset * DAY_IN_MS,
  );
  const endDate = new Date(startDate.getTime() + 6 * DAY_IN_MS);

  return {
    start: formatUtcDate(startDate),
    end: formatUtcDate(endDate),
  };
}

export function getOrganizationMonthRange(timezone: string) {
  const today = getZonedDate(new Date(), timezone);
  const startDate = new Date(
    Date.UTC(today.utcDate.getUTCFullYear(), today.utcDate.getUTCMonth(), 1),
  );

  return {
    start: formatUtcDate(startDate),
    end: formatUtcDate(today.utcDate),
  };
}

export async function getTodayAttendanceRecord(params: {
  organizationId: string;
  membershipId: string;
  workDate: string;
}) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      'id, work_date, clock_in_at, clock_out_at, clock_in_location, clock_out_location, created_at',
    )
    .eq('organization_id', params.organizationId)
    .eq('membership_id', params.membershipId)
    .eq('work_date', params.workDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapAttendanceRow(data as AttendanceRow) : null;
}

export async function getAttendanceRecordsForRange(params: {
  organizationId: string;
  membershipId: string;
  startDate: string;
  endDate: string;
}) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      'id, work_date, clock_in_at, clock_out_at, clock_in_location, clock_out_location, created_at',
    )
    .eq('organization_id', params.organizationId)
    .eq('membership_id', params.membershipId)
    .gte('work_date', params.startDate)
    .lte('work_date', params.endDate)
    .order('work_date', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapAttendanceRow(row as AttendanceRow));
}

export async function getRecentAttendanceEvents(params: {
  organizationId: string;
  membershipId: string;
  recordLimit?: number;
  eventLimit?: number;
}) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(
      'id, work_date, clock_in_at, clock_out_at, clock_in_location, clock_out_location, created_at',
    )
    .eq('organization_id', params.organizationId)
    .eq('membership_id', params.membershipId)
    .order('work_date', { ascending: false })
    .limit(params.recordLimit ?? 10);

  if (error) {
    throw new Error(error.message);
  }

  const events = (data ?? [])
    .flatMap((row) => buildEventsFromRow(row as AttendanceRow))
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    );

  return events.slice(0, params.eventLimit ?? 8);
}

export async function registerClockIn(params: {
  organizationId: string;
  membershipId: string;
  workDate: string;
  clockInAt: string;
  clockInLocation: AttendanceLocation;
}) {
  const existingRecord = await getTodayAttendanceRecord({
    organizationId: params.organizationId,
    membershipId: params.membershipId,
    workDate: params.workDate,
  });

  if (existingRecord?.clockInAt) {
    throw new Error('La entrada de hoy ya está registrada.');
  }

  const { error } = await supabase.from('attendance_records').insert({
    organization_id: params.organizationId,
    membership_id: params.membershipId,
    work_date: params.workDate,
    clock_in_at: params.clockInAt,
    clock_in_location: params.clockInLocation,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function registerClockOut(params: {
  attendanceId: string;
  clockOutAt: string;
  clockOutLocation: AttendanceLocation;
}) {
  const { error } = await supabase
    .from('attendance_records')
    .update({
      clock_out_at: params.clockOutAt,
      clock_out_location: params.clockOutLocation,
    })
    .eq('id', params.attendanceId)
    .is('clock_out_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getPaginatedAttendanceRecords(params: {
  organizationId: string;
  membershipId: string;
  page: number;
  pageSize: number;
  type?: AttendanceTypeFilter;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from('attendance_records')
    .select(
      'id, work_date, clock_in_at, clock_out_at, clock_in_location, clock_out_location, created_at',
      {
        count: 'exact',
      },
    )
    .eq('organization_id', params.organizationId)
    .eq('membership_id', params.membershipId);

  if (params.startDate) {
    query = query.gte('work_date', params.startDate);
  }

  if (params.endDate) {
    query = query.lte('work_date', params.endDate);
  }

  if (params.type === 'clock_out') {
    query = query.not('clock_out_at', 'is', null);
  }

  const from = params.page * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data, error, count } = await query
    .order('work_date', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    records: (data ?? []).map((row) => mapAttendanceRow(row as AttendanceRow)),
    total: count ?? 0,
  };
}

export function calculateWeeklyTotals(records: AttendanceRecord[]) {
  const completedDays = records.filter(
    (record) => Boolean(record.clockInAt) && Boolean(record.clockOutAt),
  );

  const totalMinutes = completedDays.reduce((accumulator, record) => {
    const startMs = new Date(record.clockInAt).getTime();
    const endMs = record.clockOutAt ? new Date(record.clockOutAt).getTime() : 0;

    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return accumulator;
    }

    return accumulator + Math.floor((endMs - startMs) / 60000);
  }, 0);

  return {
    totalMinutes,
    attendedDays: completedDays.length,
  };
}

export function calculateAttendanceDays(records: AttendanceRecord[]) {
  const attendedDays = new Set(
    records
      .filter((record) => Boolean(record.clockInAt))
      .map((record) => record.workDate),
  );

  return attendedDays.size;
}

export function calculateWorkdayStreak(
  records: AttendanceRecord[],
  timezone: string,
) {
  const attendedDays = new Set(
    records
      .filter((record) => Boolean(record.clockInAt))
      .map((record) => record.workDate),
  );

  const today = getZonedDate(new Date(), timezone).utcDate;
  let cursor = new Date(today);

  while (isWeekendUtcDate(cursor)) {
    cursor = addUtcDays(cursor, -1);
  }

  const todayKey = formatUtcDate(cursor);
  if (!attendedDays.has(todayKey)) {
    return 0;
  }

  let streak = 0;
  while (!isWeekendUtcDate(cursor)) {
    const cursorKey = formatUtcDate(cursor);
    if (!attendedDays.has(cursorKey)) {
      break;
    }
    streak += 1;
    cursor = getPreviousWorkday(cursor);
  }

  return streak;
}

function mapAttendanceRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    workDate: row.work_date,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    clockInLocation: row.clock_in_location,
    clockOutLocation: row.clock_out_location,
    createdAt: row.created_at,
  };
}

function buildEventsFromRow(row: AttendanceRow): AttendanceEvent[] {
  const events: AttendanceEvent[] = [
    {
      id: `${row.id}-in`,
      type: 'clock_in',
      occurredAt: row.clock_in_at,
      workDate: row.work_date,
    },
  ];

  if (row.clock_out_at) {
    events.push({
      id: `${row.id}-out`,
      type: 'clock_out',
      occurredAt: row.clock_out_at,
      workDate: row.work_date,
    });
  }

  return events;
}

function formatDateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('No se pudo resolver la fecha actual de la organización.');
  }

  return `${year}-${month}-${day}`;
}

function getZonedDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value;

  const weekday = mapWeekday(weekdayLabel);

  return {
    weekday,
    utcDate: new Date(Date.UTC(year, month - 1, day)),
  };
}

function mapWeekday(weekday: string | undefined) {
  switch (weekday) {
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    default:
      return 0;
  }
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function isWeekendUtcDate(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function getPreviousWorkday(date: Date) {
  let cursor = addUtcDays(date, -1);
  while (isWeekendUtcDate(cursor)) {
    cursor = addUtcDays(cursor, -1);
  }
  return cursor;
}
