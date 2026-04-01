import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const PROXIMITY_ERROR_CODE = {
  GPS_ACCURACY_TOO_LOW: 'GPS_ACCURACY_TOO_LOW',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  NO_OPEN_RECORD: 'NO_OPEN_RECORD',
  ALREADY_CLOCKED_IN: 'ALREADY_CLOCKED_IN',
  NO_REMOTE_OFFICE: 'NO_REMOTE_OFFICE',
} as const;

const PROXIMITY_ERROR_CODES = Object.values(PROXIMITY_ERROR_CODE) as [
  ProximityErrorCode,
  ...ProximityErrorCode[],
];

const validateProximityResponseSchema = z.object({
  valid: z.boolean().optional(),
  office_id: z.string().min(1).optional(),
  office_name: z.string().min(1).optional(),
  error_code: z
    .enum([
      PROXIMITY_ERROR_CODE.GPS_ACCURACY_TOO_LOW,
      PROXIMITY_ERROR_CODE.OUT_OF_RANGE,
    ])
    .optional(),
});

const attendanceClockInResponseSchema = z.object({
  success: z.boolean().optional(),
  error_code: z.enum(PROXIMITY_ERROR_CODES).optional(),
  record_id: z.string().min(1).optional(),
  office_id: z.string().min(1).optional(),
  office_name: z.string().min(1).optional(),
});

const attendanceClockOutResponseSchema = z.object({
  success: z.boolean().optional(),
  error_code: z.enum(PROXIMITY_ERROR_CODES).optional(),
  office_id: z.string().min(1).optional(),
  office_name: z.string().min(1).optional(),
});

const openShiftRowSchema = z.object({
  record_id: z.string().min(1),
  work_date: z.string().min(1),
  clock_in_at: z.string().min(1),
  office_id: z.string().min(1),
  office_name: z.string().nullable(),
  office_is_remote: z.boolean(),
  shift_duration_hours: z.number(),
  break_duration_hours: z.number(),
});

const updateEmployeeProfileResponseSchema = z.object({
  success: z.boolean(),
  error_code: z.string().optional(),
});

const attendanceHistoryFilterSchema = z.object({
  year: z.number().int().nullable(),
  month: z.number().int().nullable(),
  period_key: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

const attendanceHistoryAvailablePeriodSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  period_key: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
});

const attendanceHistorySummarySchema = z.object({
  weekly_hours: z.number(),
  worked_days: z.number().int(),
  total_minutes: z.number().int(),
  overtime_minutes: z.number().int(),
});

const attendanceHistoryItemSchema = z.object({
  id: z.string().min(1),
  work_date: z.string().min(1),
  has_record: z.boolean(),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  auto_closed: z.boolean(),
  status: z
    .enum(['complete', 'incomplete', 'auto_closed', 'absence'])
    .nullable(),
  worked_minutes: z.number().int(),
  required_minutes: z.number().int(),
  office_id: z.string().nullable(),
  office_name: z.string().nullable(),
  office_is_remote: z.boolean(),
});

const attendanceHistoryPayloadSchema = z.object({
  page: z.number().int(),
  page_size: z.number().int(),
  total_items: z.number().int(),
  total_pages: z.number().int(),
  has_previous_page: z.boolean(),
  has_next_page: z.boolean(),
  filter: attendanceHistoryFilterSchema.nullable(),
  available_periods: z.array(attendanceHistoryAvailablePeriodSchema),
  summary: attendanceHistorySummarySchema.nullable(),
  items: z.array(attendanceHistoryItemSchema),
});

const attendanceRowSchema = z.object({
  id: z.string().min(1),
  work_date: z.string().min(1),
  clock_in_at: z.string().min(1),
  clock_out_at: z.string().nullable(),
  break_duration_hours: z.number().nullable(),
  office_id: z.string().min(1),
  office_name: z.string().nullable(),
  office_is_remote: z.boolean(),
  created_at: z.string().min(1),
});

const attendanceRowsSchema = z.array(attendanceRowSchema);

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

export const ATTENDANCE_EVENT_TYPE = {
  CLOCK_IN: 'clock_in',
  CLOCK_OUT: 'clock_out',
} as const;

export type AttendanceEventType =
  (typeof ATTENDANCE_EVENT_TYPE)[keyof typeof ATTENDANCE_EVENT_TYPE];

export type AttendanceEvent = {
  id: string;
  type: AttendanceEventType;
  occurredAt: string;
  workDate: string;
  officeName?: string | null;
  officeIsRemote?: boolean;
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

export interface AttendanceHistoryFilter {
  year: number | null;
  month: number | null;
  periodKey: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface AttendanceHistoryAvailablePeriod {
  year: number;
  month: number;
  periodKey: string;
  startDate: string;
  endDate: string;
}

export interface AttendanceHistoryPageItem {
  id: string;
  workDate: string;
  hasRecord: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  autoClosed: boolean;
  status: 'complete' | 'incomplete' | 'auto_closed' | 'absence';
  workedMinutes: number;
  requiredMinutes: number;
  officeId: string | null;
  officeName: string | null;
  officeIsRemote: boolean;
}

export interface AttendanceHistoryPageSummary {
  weeklyHours: number;
  workedDays: number;
  totalMinutes: number;
  overtimeMinutes: number;
}

interface CalculateWeeklyTotalsOptions {
  includeOpenShiftMinutes?: boolean;
  now?: Date;
}

export interface AttendanceHistoryPageResult {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  filter: AttendanceHistoryFilter;
  availablePeriods: AttendanceHistoryAvailablePeriod[];
  summary: AttendanceHistoryPageSummary;
  items: AttendanceHistoryPageItem[];
}

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

export function getOrganizationToday(timezone: string): string {
  return formatDateInTimezone(new Date(), timezone);
}

export function getOrganizationWeekRange(timezone: string): {
  start: string;
  end: string;
} {
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

export function getOrganizationMonthRange(timezone: string): {
  start: string;
  end: string;
} {
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

function assertSuccessfulClockRpcResult(
  result:
    | z.infer<typeof attendanceClockInResponseSchema>
    | z.infer<typeof attendanceClockOutResponseSchema>,
  operation: 'entrada' | 'salida',
) {
  if (result.success === false && result.error_code) {
    throw new ProximityError(
      result.error_code,
      mapProximityErrorMessage(result.error_code),
    );
  }

  if (result.success !== true) {
    throw new Error(
      `La respuesta del registro de ${operation} llegó con un contrato inválido.`,
    );
  }
}

export async function getTodayAttendanceRecord(params: {
  organizationId: string;
  membershipId: string;
  workDate: string;
}): Promise<AttendanceRecord | null> {
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

  const parsedRow = openShiftRowSchema.safeParse(data);

  if (!parsedRow.success) {
    throw new Error(
      'La respuesta de jornada abierta llegó con un formato inválido.',
    );
  }

  const row = parsedRow.data;

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
}): Promise<AttendanceRecord[]> {
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
}): Promise<AttendanceEvent[]> {
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

  const parsedResponse = validateProximityResponseSchema.safeParse(data);

  if (!parsedResponse.success) {
    throw new Error('No se pudo validar la proximidad a la oficina.');
  }

  const result = parsedResponse.data;

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
}): Promise<{ recordId?: string; officeId?: string; officeName?: string }> {
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

  const parsedResponse = attendanceClockInResponseSchema.safeParse(data);

  if (!parsedResponse.success) {
    throw new Error('La respuesta del registro de entrada llegó inválida.');
  }

  const result = parsedResponse.data;

  assertSuccessfulClockRpcResult(result, 'entrada');

  return {
    recordId: result.record_id,
    officeId: result.office_id,
    officeName: result.office_name,
  };
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
}): Promise<{ officeId?: string; officeName?: string }> {
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

  const parsedResponse = attendanceClockOutResponseSchema.safeParse(data);

  if (!parsedResponse.success) {
    throw new Error('La respuesta del registro de salida llegó inválida.');
  }

  const result = parsedResponse.data;

  assertSuccessfulClockRpcResult(result, 'salida');

  return {
    officeId: result.office_id,
    officeName: result.office_name,
  };
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

  const parsedResponse = updateEmployeeProfileResponseSchema.safeParse(data);

  if (!parsedResponse.success) {
    throw new Error(
      'La respuesta de actualización del perfil llegó con un formato inválido.',
    );
  }

  const result = parsedResponse.data;

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
}): Promise<{ records: AttendanceRecord[]; total: number }> {
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

export async function getAttendanceHistoryPage(params: {
  organizationId: string;
  membershipId: string;
  page: number;
  pageSize: number;
  year?: number;
  month?: number;
}): Promise<AttendanceHistoryPageResult> {
  const payload = await fetchAttendanceHistoryPayload(params);

  return {
    page: payload.page,
    pageSize: payload.page_size,
    totalItems: payload.total_items,
    totalPages: payload.total_pages,
    hasPreviousPage: payload.has_previous_page,
    hasNextPage: payload.has_next_page,
    filter: mapAttendanceHistoryFilter(payload.filter),
    availablePeriods: payload.available_periods.map(mapAttendanceHistoryPeriod),
    summary: mapAttendanceHistorySummary(payload.summary),
    items: payload.items.map(mapAttendanceHistoryItem),
  };
}

function isAttendanceDayStatus(
  value: unknown,
): value is AttendanceHistoryPageItem['status'] {
  return (
    value === 'complete' ||
    value === 'incomplete' ||
    value === 'auto_closed' ||
    value === 'absence'
  );
}

function resolveAttendanceDayStatus(params: {
  status: unknown;
  hasRecord: boolean;
  autoClosed: boolean;
  workedMinutes: number;
  requiredMinutes: number;
}): AttendanceHistoryPageItem['status'] {
  if (isAttendanceDayStatus(params.status)) {
    return params.status;
  }

  if (!params.hasRecord) {
    return 'absence';
  }

  if (params.autoClosed) {
    return 'auto_closed';
  }

  return params.workedMinutes >= params.requiredMinutes
    ? 'complete'
    : 'incomplete';
}

export async function getAllAttendanceRecords(params: {
  organizationId: string;
  membershipId: string;
}): Promise<AttendanceRecord[]> {
  const rows = await fetchAttendanceRows(params);

  return rows
    .map(mapAttendanceRow)
    .sort(
      (left, right) =>
        new Date(right.workDate).getTime() - new Date(left.workDate).getTime(),
    );
}

// ─── Pure calculation helpers ─────────────────────────────────────────────────

export function calculateWeeklyTotals(
  records: AttendanceRecord[],
  options: CalculateWeeklyTotalsOptions = {},
): { totalMinutes: number; attendedDays: number } {
  const attendedDays = calculateAttendanceDays(records);
  const includeOpenShiftMinutes = options.includeOpenShiftMinutes ?? true;
  const now = options.now ?? new Date();

  const totalMinutes = records.reduce((accumulator, record) => {
    const minutes = getRecordMinutes(record, {
      includeOpenShiftMinutes,
      referenceTime: now,
    });

    if (minutes <= 0) {
      return accumulator;
    }

    return accumulator + minutes;
  }, 0);

  return {
    totalMinutes,
    attendedDays,
  };
}

export function calculateAttendanceDays(records: AttendanceRecord[]): number {
  const attendedDays = new Set(
    records
      .filter((record) => Boolean(record.clockInAt))
      .map((record) => record.workDate),
  );

  return attendedDays.size;
}

export function getAttendanceMonthOptions(
  records: AttendanceRecord[],
): AttendanceMonthOption[] {
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
): number {
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
      officeName: row.office_name,
      officeIsRemote: row.office_is_remote,
    },
  ];

  if (row.clock_out_at) {
    events.push({
      id: `${row.id}-out`,
      type: 'clock_out',
      occurredAt: row.clock_out_at,
      workDate: row.work_date,
      officeName: row.office_name,
      officeIsRemote: row.office_is_remote,
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

  const parsedRows = attendanceRowsSchema.safeParse(data ?? []);

  if (!parsedRows.success) {
    throw new Error(
      'Los registros de asistencia llegaron con un formato inválido.',
    );
  }

  return parsedRows.data;
}

async function fetchAttendanceHistoryPayload(params: {
  organizationId: string;
  membershipId: string;
  page: number;
  pageSize: number;
  year?: number;
  month?: number;
}) {
  const { data, error } = await supabase.rpc('get_attendance_history_page', {
    p_organization_id: params.organizationId,
    p_membership_id: params.membershipId,
    p_page: params.page,
    p_page_size: params.pageSize,
    p_year: params.year ?? null,
    p_month: params.month ?? null,
  });

  if (error) {
    if (
      error.message.includes('get_attendance_history_page') &&
      error.message.toLowerCase().includes('schema cache')
    ) {
      throw new Error(
        'El historial mensual no está disponible todavía. Falta aplicar la migración de attendance history en Supabase.',
      );
    }

    throw new Error(error.message);
  }

  const parsedPayload = attendanceHistoryPayloadSchema.safeParse(data);

  if (!parsedPayload.success) {
    throw new Error('No se pudo cargar el historial de asistencia.');
  }

  return parsedPayload.data;
}

function mapAttendanceHistoryFilter(
  filter: z.infer<typeof attendanceHistoryFilterSchema> | null,
): AttendanceHistoryFilter {
  return {
    year: filter?.year ?? null,
    month: filter?.month ?? null,
    periodKey: filter?.period_key ?? null,
    startDate: filter?.start_date ?? null,
    endDate: filter?.end_date ?? null,
  };
}

function mapAttendanceHistoryPeriod(
  period: z.infer<typeof attendanceHistoryAvailablePeriodSchema>,
): AttendanceHistoryAvailablePeriod {
  return {
    year: period.year,
    month: period.month,
    periodKey: period.period_key,
    startDate: period.start_date,
    endDate: period.end_date,
  };
}

function mapAttendanceHistorySummary(
  summary: z.infer<typeof attendanceHistorySummarySchema> | null,
): AttendanceHistoryPageSummary {
  return {
    weeklyHours: summary?.weekly_hours ?? 40,
    workedDays: summary?.worked_days ?? 0,
    totalMinutes: summary?.total_minutes ?? 0,
    overtimeMinutes: summary?.overtime_minutes ?? 0,
  };
}

function mapAttendanceHistoryItem(
  item: z.infer<typeof attendanceHistoryItemSchema>,
): AttendanceHistoryPageItem {
  return {
    id: item.id,
    workDate: item.work_date,
    hasRecord: item.has_record,
    clockInAt: item.clock_in_at,
    clockOutAt: item.clock_out_at,
    autoClosed: item.auto_closed,
    status: resolveAttendanceDayStatus({
      status: item.status,
      hasRecord: item.has_record,
      autoClosed: item.auto_closed,
      workedMinutes: item.worked_minutes,
      requiredMinutes: item.required_minutes,
    }),
    workedMinutes: item.worked_minutes,
    requiredMinutes: item.required_minutes,
    officeId: item.office_id,
    officeName: item.office_name,
    officeIsRemote: item.office_is_remote,
  };
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
  const startMs = new Date(record.clockInAt).getTime();
  const endMs = record.clockOutAt ? new Date(record.clockOutAt).getTime() : NaN;

  return getWorkedMinutesWithBreak({
    startMs,
    endMs,
    breakDurationHours: record.breakDurationHours,
  });
}

function getRecordMinutes(
  record: AttendanceRecord,
  options: {
    includeOpenShiftMinutes: boolean;
    referenceTime: Date;
  },
) {
  const startMs = new Date(record.clockInAt).getTime();
  const endMs = record.clockOutAt
    ? new Date(record.clockOutAt).getTime()
    : options.includeOpenShiftMinutes
      ? options.referenceTime.getTime()
      : NaN;

  return getWorkedMinutesWithBreak({
    startMs,
    endMs,
    breakDurationHours: record.breakDurationHours,
  });
}

function getWorkedMinutesWithBreak(params: {
  startMs: number;
  endMs: number;
  breakDurationHours: number;
}) {
  const { startMs, endMs, breakDurationHours } = params;

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }

  const workedMinutes = Math.floor((endMs - startMs) / 60000);
  const breakMinutes = Math.max(0, Math.round(breakDurationHours * 60));

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
