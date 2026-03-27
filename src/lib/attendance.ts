import { supabase } from '@/lib/supabase';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const PROXIMITY_ERROR_CODE = {
  GPS_ACCURACY_TOO_LOW: 'GPS_ACCURACY_TOO_LOW',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  NO_OPEN_RECORD: 'NO_OPEN_RECORD',
  ALREADY_CLOCKED_IN: 'ALREADY_CLOCKED_IN',
  NO_REMOTE_OFFICE: 'NO_REMOTE_OFFICE',
} as const;

// ─── Internal DB row type (from get_attendance_records RPC) ──────────────────

type AttendanceRow = {
  id: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_duration_hours: number | null;
  office_id: string;
  office_name: string | null;
  office_is_remote: boolean;
  created_at: string;
};

type OpenShiftRow = {
  record_id: string;
  work_date: string;
  clock_in_at: string;
  office_id: string;
  office_name: string | null;
  office_is_remote: boolean;
  shift_duration_hours: number;
  break_duration_hours: number;
};

// ─── Public types ─────────────────────────────────────────────────────────────

export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  isRemote?: boolean;
};

export type ProximityErrorCode =
  (typeof PROXIMITY_ERROR_CODE)[keyof typeof PROXIMITY_ERROR_CODE];

export interface ValidateProximityParams {
  organizationId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface ValidateProximityResult {
  valid: boolean;
  officeId?: string;
  officeName?: string;
  errorCode?: Extract<
    ProximityErrorCode,
    'GPS_ACCURACY_TOO_LOW' | 'OUT_OF_RANGE'
  >;
}

export class ProximityError extends Error {
  constructor(
    public code: ProximityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProximityError';
  }
}

export type AttendanceRecord = {
  id: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  breakDurationHours: number;
  officeId: string;
  officeName: string | null;
  officeIsRemote: boolean;
  createdAt: string;
};

export interface OpenShift {
  recordId: string;
  workDate: string;
  clockInAt: string;
  officeId: string;
  officeName: string | null;
  officeIsRemote: boolean;
  shiftDurationHours: number;
  breakDurationHours: number;
}

export type AttendanceEvent = {
  id: string;
  type: 'clock_in' | 'clock_out';
  occurredAt: string;
  workDate: string;
};

export type AttendanceTypeFilter = 'all' | 'clock_in' | 'clock_out';

export type AttendanceMonthOption = {
  key: string;
  label: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
};

export type AttendanceSummary = {
  totalMinutes: number;
  overtimeMinutes: number;
  workedDays: number;
};

export interface UpdateEmployeeProfileParams {
  membershipId: string;
  shiftDurationHours?: number;
  breakDurationHours?: number;
  weeklyHours?: number;
  position?: string;
  department?: string;
  hireDate?: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

// ─── Data access (RPC-backed) ─────────────────────────────────────────────────

function mapProximityErrorMessage(code: ProximityErrorCode): string {
  switch (code) {
    case 'GPS_ACCURACY_TOO_LOW':
      return 'Señal GPS débil. Intentá moverte a un lugar abierto para mejorar la precisión.';
    case 'OUT_OF_RANGE':
      return 'No estás cerca de ninguna oficina. Podés registrarte como Remoto.';
    case 'NO_OPEN_RECORD':
      return 'No tenés un registro de entrada abierto.';
    case 'ALREADY_CLOCKED_IN':
      return 'Ya tenés un registro de entrada activo.';
    case 'NO_REMOTE_OFFICE':
      return 'No hay una oficina remota configurada para tu organización.';
    default:
      return 'Error desconocido al validar la ubicación.';
  }
}

export async function getTodayAttendanceRecord(params: {
  organizationId: string;
  membershipId: string;
  workDate: string;
}) {
  const rows = await fetchAttendanceRows({
    organizationId: params.organizationId,
    membershipId: params.membershipId,
    startDate: params.workDate,
    endDate: params.workDate,
  });
  const row = rows && rows.length > 0 ? rows[0] : null;

  return row ? mapAttendanceRow(row) : null;
}

export async function getOpenShift(
  membershipId: string,
): Promise<OpenShift | null> {
  const { data, error } = await supabase.rpc('get_open_shift', {
    p_membership_id: membershipId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as OpenShiftRow;

  return {
    recordId: row.record_id,
    workDate: row.work_date,
    clockInAt: row.clock_in_at,
    officeId: row.office_id,
    officeName: row.office_name,
    officeIsRemote: row.office_is_remote,
    shiftDurationHours: row.shift_duration_hours,
    breakDurationHours: row.break_duration_hours,
  };
}

export async function getAttendanceRecordsForRange(params: {
  organizationId: string;
  membershipId: string;
  startDate: string;
  endDate: string;
}) {
  const rows = await fetchAttendanceRows({
    organizationId: params.organizationId,
    membershipId: params.membershipId,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  return rows
    .map(mapAttendanceRow)
    .sort(
      (left, right) =>
        new Date(right.workDate).getTime() - new Date(left.workDate).getTime(),
    );
}

export async function getRecentAttendanceEvents(params: {
  organizationId: string;
  membershipId: string;
  recordLimit?: number;
  eventLimit?: number;
}) {
  const rows = await fetchAttendanceRows({
    organizationId: params.organizationId,
    membershipId: params.membershipId,
  });

  const events = rows
    .sort(
      (left, right) =>
        new Date(right.work_date).getTime() -
        new Date(left.work_date).getTime(),
    )
    .slice(0, params.recordLimit ?? 10)
    .flatMap(buildEventsFromRow)
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    );

  return events.slice(0, params.eventLimit ?? 8);
}

export async function validateProximity(
  params: ValidateProximityParams,
): Promise<ValidateProximityResult> {
  const { data, error } = await supabase.rpc('validate_proximity', {
    p_organization_id: params.organizationId,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_accuracy: params.accuracy,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('No se pudo validar la proximidad a la oficina.');
  }

  const result = data as {
    valid?: boolean;
    office_id?: string;
    office_name?: string;
    error_code?: ValidateProximityResult['errorCode'];
  };

  return {
    valid: result.valid ?? false,
    officeId: result.office_id,
    officeName: result.office_name,
    errorCode: result.error_code,
  };
}

export async function registerClockIn(params: {
  organizationId: string;
  membershipId: string;
  workDate: string;
  /**
   * @deprecated The DB sets clock_in_at = now() internally.
   * This param is retained for call-site API compatibility and is not sent to the RPC.
   */
  clockInAt: string;
  clockInLocation: AttendanceLocation;
  officeId?: string;
}) {
  const existingRecord = await getTodayAttendanceRecord({
    organizationId: params.organizationId,
    membershipId: params.membershipId,
    workDate: params.workDate,
  });

  if (existingRecord?.clockInAt) {
    throw new ProximityError(
      'ALREADY_CLOCKED_IN',
      'La entrada de hoy ya está registrada.',
    );
  }

  const { data, error } = await supabase.rpc('attendance_clock_in', {
    p_organization_id: params.organizationId,
    p_membership_id: params.membershipId,
    p_work_date: params.workDate,
    p_latitude: params.clockInLocation.latitude,
    p_longitude: params.clockInLocation.longitude,
    p_accuracy: params.clockInLocation.accuracy ?? undefined,
    p_office_id: params.officeId ?? undefined,
    p_is_remote: params.clockInLocation.isRemote ?? false,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Parse RPC JSONB response
  if (data && typeof data === 'object') {
    const result = data as {
      success?: boolean;
      error_code?: string;
      record_id?: string;
      office_id?: string;
      office_name?: string;
    };

    if (!result.success && result.error_code) {
      throw new ProximityError(
        result.error_code as ProximityErrorCode,
        mapProximityErrorMessage(result.error_code as ProximityErrorCode),
      );
    }

    // Success case - return full response
    return {
      recordId: result.record_id,
      officeId: result.office_id,
      officeName: result.office_name,
    };
  }
}

export async function registerClockOut(params: {
  attendanceId: string;
  /**
   * @deprecated The DB sets clock_out_at = now() internally.
   * This param is retained for call-site API compatibility and is not sent to the RPC.
   */
  clockOutAt: string;
  clockOutLocation: AttendanceLocation;
  customCloseAt?: string;
  autoClosed?: boolean;
}) {
  const { data, error } = await supabase.rpc('attendance_clock_out', {
    p_record_id: params.attendanceId,
    p_latitude: params.clockOutLocation.latitude,
    p_longitude: params.clockOutLocation.longitude,
    p_accuracy: params.clockOutLocation.accuracy ?? undefined,
    p_custom_close_at: params.customCloseAt ?? null,
    p_auto_closed: params.autoClosed ?? false,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Parse RPC JSONB response
  if (data && typeof data === 'object') {
    const result = data as {
      success?: boolean;
      error_code?: string;
      office_id?: string;
      office_name?: string;
    };

    if (!result.success && result.error_code) {
      throw new ProximityError(
        result.error_code as ProximityErrorCode,
        mapProximityErrorMessage(result.error_code as ProximityErrorCode),
      );
    }

    // Success case - return office info
    return {
      officeId: result.office_id,
      officeName: result.office_name,
    };
  }
}

export async function updateEmployeeProfile(
  params: UpdateEmployeeProfileParams,
): Promise<{ success: boolean; errorCode?: string }> {
  const { data, error } = await supabase.rpc('update_employee_profile', {
    p_membership_id: params.membershipId,
    p_shift_duration_hours: params.shiftDurationHours,
    p_break_duration_hours: params.breakDurationHours,
    p_weekly_hours: params.weeklyHours,
    p_position: params.position,
    p_department: params.department,
    p_hire_date: params.hireDate,
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== 'object') {
    return { success: false };
  }

  const result = data as {
    success?: boolean;
    error_code?: string;
  };

  return {
    success: result.success ?? false,
    errorCode: result.error_code,
  };
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
  let rows = await fetchAttendanceRows({
    organizationId: params.organizationId,
    membershipId: params.membershipId,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  if (params.type === 'clock_out') {
    rows = rows.filter((row) => row.clock_out_at !== null);
  }

  rows = rows.sort(
    (left, right) =>
      new Date(right.work_date).getTime() - new Date(left.work_date).getTime(),
  );

  const total = rows.length;
  const from = params.page * params.pageSize;
  const to = from + params.pageSize;

  return {
    records: rows.slice(from, to).map(mapAttendanceRow),
    total,
  };
}

export async function getAllAttendanceRecords(params: {
  organizationId: string;
  membershipId: string;
}) {
  const rows = await fetchAttendanceRows(params);

  return rows
    .map(mapAttendanceRow)
    .sort(
      (left, right) =>
        new Date(right.workDate).getTime() - new Date(left.workDate).getTime(),
    );
}

// ─── Pure calculation helpers ─────────────────────────────────────────────────

export function calculateWeeklyTotals(records: AttendanceRecord[]) {
  const completedDays = records.filter(
    (record) => Boolean(record.clockInAt) && Boolean(record.clockOutAt),
  );

  const totalMinutes = completedDays.reduce((accumulator, record) => {
    const minutes = getCompletedRecordMinutes(record);

    if (minutes <= 0) {
      return accumulator;
    }

    return accumulator + minutes;
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

export function getAttendanceMonthOptions(records: AttendanceRecord[]) {
  const monthMap = new Map<string, AttendanceMonthOption>();

  for (const record of records) {
    const [yearPart, monthPart] = record.workDate.split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      continue;
    }

    const key = `${yearPart}-${monthPart}`;
    if (monthMap.has(key)) {
      continue;
    }

    const startDate = `${key}-01`;
    const endDate = formatUtcDate(new Date(Date.UTC(year, month, 0)));

    monthMap.set(key, {
      key,
      label: formatAttendanceMonthLabel(year, month),
      year,
      month,
      startDate,
      endDate,
    });
  }

  return Array.from(monthMap.values()).sort((left, right) => {
    if (left.year === right.year) {
      return right.month - left.month;
    }

    return right.year - left.year;
  });
}

export function calculateAttendanceSummary(
  records: AttendanceRecord[],
  weeklyHours = 40,
): AttendanceSummary {
  const workedDays = calculateAttendanceDays(records);
  const weeklyMinutes = new Map<string, number>();

  const totalMinutes = records.reduce((accumulator, record) => {
    const minutes = getCompletedRecordMinutes(record);
    if (minutes <= 0) {
      return accumulator;
    }

    const weekKey = getWeekStartKey(record.workDate);
    weeklyMinutes.set(weekKey, (weeklyMinutes.get(weekKey) ?? 0) + minutes);

    return accumulator + minutes;
  }, 0);

  const overtimeMinutes = Array.from(weeklyMinutes.values()).reduce(
    (accumulator, minutes) =>
      accumulator + Math.max(0, minutes - weeklyHours * 60),
    0,
  );

  return {
    totalMinutes,
    overtimeMinutes,
    workedDays,
  };
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

// ─── Private mappers ──────────────────────────────────────────────────────────

function mapAttendanceRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    workDate: row.work_date,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    breakDurationHours: row.break_duration_hours ?? 0.75,
    officeId: row.office_id,
    officeName: row.office_name,
    officeIsRemote: row.office_is_remote,
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

async function fetchAttendanceRows(params: {
  organizationId: string;
  membershipId: string;
  startDate?: string;
  endDate?: string;
}) {
  const { data, error } = await supabase.rpc('get_attendance_records', {
    p_organization_id: params.organizationId,
    p_membership_id: params.membershipId,
    p_start_date: params.startDate ?? undefined,
    p_end_date: params.endDate ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as AttendanceRow[] | null) ?? [];
}

// ─── Private date utilities ───────────────────────────────────────────────────

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

function getCompletedRecordMinutes(record: AttendanceRecord) {
  if (!record.clockOutAt) {
    return 0;
  }

  const startMs = new Date(record.clockInAt).getTime();
  const endMs = new Date(record.clockOutAt).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }

  const workedMinutes = Math.floor((endMs - startMs) / 60000);
  const breakMinutes = Math.max(0, Math.round(record.breakDurationHours * 60));

  return Math.max(0, workedMinutes - breakMinutes);
}

function getWeekStartKey(workDate: string) {
  const utcDate = new Date(`${workDate}T00:00:00Z`);

  if (Number.isNaN(utcDate.getTime())) {
    return workDate;
  }

  const day = utcDate.getUTCDay();
  const mondayOffset = (day + 6) % 7;

  return formatUtcDate(addUtcDays(utcDate, -mondayOffset));
}

function formatAttendanceMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
