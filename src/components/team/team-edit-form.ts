import {
  decimalToHHMM,
  formatDateForDisplay,
  getTodayStorageDate,
  normalizeDateForStorage,
  normalizeOptionalText,
  parseHHMMInput,
} from './team-date-time-format';
import {
  DEFAULT_DEPARTMENT,
  type MembershipRole,
  type TeamMember,
} from './team-member';

export interface EditEmployeeFormValues {
  breakDurationHours: string;
  department: string;
  hireDate: string;
  position: string;
  role: MembershipRole;
  shiftDurationHours: string;
  weeklyHours: string;
}

export interface EditEmployeeFormErrors {
  breakDurationHours?: string;
  department?: string;
  hireDate?: string;
  position?: string;
  role?: string;
  shiftDurationHours?: string;
  weeklyHours?: string;
}

export const DEFAULT_BREAK_DURATION_HOURS = 0.75;
export const DEFAULT_SHIFT_DURATION_HOURS = 8;
export const MAX_BREAK_DURATION_HOURS = 5;
export const MAX_SHIFT_DURATION_HOURS = 15;
export const DEFAULT_WEEKLY_HOURS = 40;
export const MAX_WEEKLY_HOURS = 100;

export function getEmptyEditFormValues(): EditEmployeeFormValues {
  return {
    breakDurationHours: decimalToHHMM(DEFAULT_BREAK_DURATION_HOURS),
    department: '',
    hireDate: '',
    position: '',
    role: 'employee',
    shiftDurationHours: decimalToHHMM(DEFAULT_SHIFT_DURATION_HOURS),
    weeklyHours: String(DEFAULT_WEEKLY_HOURS),
  };
}

export function createEditFormValues(
  member: TeamMember,
): EditEmployeeFormValues {
  return {
    breakDurationHours: decimalToHHMM(member.breakDurationHours),
    department:
      member.department === DEFAULT_DEPARTMENT ? '' : member.department,
    hireDate: formatDateForDisplay(member.hireDate),
    position: member.position,
    role: member.role,
    shiftDurationHours: decimalToHHMM(member.shiftDurationHours),
    weeklyHours: String(member.weeklyHours),
  };
}

export function validateEditForm(values: EditEmployeeFormValues) {
  const errors: EditEmployeeFormErrors = {};
  const shiftDurationHours = parseHHMMInput(values.shiftDurationHours);
  const breakDurationHours = parseHHMMInput(values.breakDurationHours);
  const hireDate = normalizeDateForStorage(values.hireDate);
  const todayStorageDate = getTodayStorageDate();

  if (shiftDurationHours === null || shiftDurationHours <= 0) {
    errors.shiftDurationHours =
      'La jornada debe tener formato HH:MM y ser mayor a 00:00.';
  } else if (shiftDurationHours > MAX_SHIFT_DURATION_HOURS) {
    errors.shiftDurationHours =
      'La jornada laboral no puede superar las 15:00 horas.';
  }

  if (breakDurationHours === null) {
    errors.breakDurationHours = 'La colación debe tener formato HH:MM.';
  } else if (breakDurationHours < 0) {
    errors.breakDurationHours = 'La colación no puede ser negativa.';
  } else if (breakDurationHours > MAX_BREAK_DURATION_HOURS) {
    errors.breakDurationHours = 'La colación no puede superar las 05:00 horas.';
  } else if (
    shiftDurationHours !== null &&
    breakDurationHours >= shiftDurationHours
  ) {
    errors.breakDurationHours = 'La colación debe ser menor que la jornada.';
  }

  if (values.hireDate.trim().length > 0 && hireDate === null) {
    errors.hireDate = 'La fecha debe tener formato DD/MM/YYYY.';
  } else if (hireDate && hireDate > todayStorageDate) {
    errors.hireDate = 'La fecha de contratación no puede ser posterior a hoy.';
  }

  const weeklyHours = Number(values.weeklyHours);
  if (Number.isNaN(weeklyHours) || weeklyHours <= 0) {
    errors.weeklyHours = 'Las horas semanales deben ser mayor a 0.';
  } else if (weeklyHours > MAX_WEEKLY_HOURS) {
    errors.weeklyHours = `Las horas semanales no pueden superar ${MAX_WEEKLY_HOURS}.`;
  }

  if (
    errors.shiftDurationHours ||
    errors.breakDurationHours ||
    errors.hireDate ||
    errors.weeklyHours ||
    shiftDurationHours === null ||
    breakDurationHours === null
  ) {
    return {
      errors,
      isValid: false,
      parsed: null,
    } as const;
  }

  return {
    errors,
    isValid: true,
    parsed: {
      breakDurationHours,
      department: normalizeOptionalText(values.department),
      hireDate: hireDate || undefined,
      position: normalizeOptionalText(values.position),
      shiftDurationHours,
      weeklyHours,
    },
  } as const;
}
