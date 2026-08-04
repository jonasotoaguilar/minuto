import type { AttendanceEventType, OpenShift } from '@/lib/attendance';

export type RecentHistoryItem = {
  id: string;
  type: AttendanceEventType;
  occurredAt: string;
  workDate: string;
  officeName: string;
  officeIsRemote: boolean;
};

export function getBlockedMessage(
  reason?: 'gps_accuracy' | 'permission_denied' | 'location_unavailable',
) {
  switch (reason) {
    case 'gps_accuracy':
      return 'Señal GPS débil. Intentá moverte a un lugar abierto.';
    case 'permission_denied':
      return 'Necesitamos acceso a tu ubicación para validar tu zona de trabajo.';
    case 'location_unavailable':
    default:
      return 'No se pudo obtener tu ubicación. Intentá de nuevo.';
  }
}

export function formatClock(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatLongDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatCompactDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function formatDisplayDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: timezone,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function formatHoursLabel(value: number) {
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

export function formatOvertimeTitle(record: OpenShift, timezone: string) {
  return `Entrada: ${formatTime(record.clockInAt, timezone)} — Jornada: ${formatHoursLabel(record.shiftDurationHours)}h + ${formatHoursLabel(record.breakDurationHours)}h colación`;
}

export function getStandardCloseAt(record: OpenShift) {
  return new Date(
    new Date(record.clockInAt).getTime() +
      (record.shiftDurationHours + record.breakDurationHours) * 3_600_000,
  );
}

export function getOvertimeThreshold(record: OpenShift) {
  return new Date(
    new Date(record.clockInAt).getTime() +
      (record.shiftDurationHours + record.breakDurationHours + 1) * 3_600_000,
  );
}

export function isOvertimeThresholdExceeded(record: OpenShift) {
  return Date.now() > getOvertimeThreshold(record).getTime();
}

export function buildRecentHistoryItems(
  records: Array<{
    id: string;
    type: AttendanceEventType;
    occurredAt: string;
    workDate: string;
    officeName?: string | null;
    officeIsRemote?: boolean;
  }>,
) {
  return records
    .map((record) => ({
      id: record.id,
      type: record.type,
      occurredAt: record.occurredAt,
      workDate: record.workDate,
      officeName: formatHistoryOfficeLabel(
        record.officeName,
        record.officeIsRemote,
      ),
      officeIsRemote: Boolean(record.officeIsRemote),
    }))
    .slice(0, 6);
}

export function formatHistoryOfficeLabel(
  officeName: string | null | undefined,
  officeIsRemote?: boolean,
) {
  if (officeIsRemote) {
    return 'Remoto';
  }

  return officeName?.trim() || 'Sin sucursal';
}
