import { z } from 'zod';

import {
  DEFAULT_BREAK_DURATION_HOURS,
  DEFAULT_SHIFT_DURATION_HOURS,
  DEFAULT_WEEKLY_HOURS,
} from './team-edit-form';
import {
  deriveInitials,
  deriveName,
  mapMembershipRole,
  normalizeDepartment,
  type TeamMember,
} from './team-member';

export const MEMBERSHIP_ROLES = [
  'owner',
  'admin',
  'manager',
  'employee',
] as const;
export const MEMBERSHIP_STATUSES = ['invited', 'active', 'suspended'] as const;

const teamMemberRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  user_id: z.string().nullable(),
  invited_email: z.string().nullable(),
  role: z.enum(MEMBERSHIP_ROLES),
  status: z.enum(MEMBERSHIP_STATUSES),
  member_position: z.string().nullable(),
  department: z.string().nullable(),
  hire_date: z.string().nullable(),
  shift_duration_hours: z.number().nullable(),
  break_duration_hours: z.number().nullable(),
  weekly_hours: z.number().nullable(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

export const teamMemberRowsSchema = z.array(teamMemberRowSchema);

export const roleUpdateResponseSchema = z.object({
  success: z.boolean().optional(),
  error_code: z.string().optional(),
});

export interface UpdateEmployeeProfileParams {
  membershipId: string;
  breakDurationHours?: number;
  department?: string;
  hireDate?: string;
  position?: string;
  shiftDurationHours?: number;
  weeklyHours?: number;
}

export interface UpdateEmployeeProfileResult {
  errorCode?: string;
  success: boolean;
}

export type UpdateEmployeeProfileFn = (
  params: UpdateEmployeeProfileParams,
) => Promise<UpdateEmployeeProfileResult>;

export function normalizeTeamMemberRows(
  rows: z.infer<typeof teamMemberRowsSchema>,
): TeamMember[] {
  return rows.map((row) => {
    const name = deriveName(
      row.full_name ?? undefined,
      row.invited_email,
      row.user_id,
      row.id,
    );

    return {
      breakDurationHours:
        row.break_duration_hours ?? DEFAULT_BREAK_DURATION_HOURS,
      department: normalizeDepartment(row.department),
      hireDate: row.hire_date?.trim() ?? '',
      email: row.email?.trim() ?? '',
      id: row.id,
      initials: deriveInitials(name),
      name,
      phone: row.phone?.trim() ?? '',
      position: row.member_position?.trim() ?? '',
      role: row.role,
      roleLabel: row.member_position?.trim() || mapMembershipRole(row.role),
      shiftDurationHours:
        row.shift_duration_hours ?? DEFAULT_SHIFT_DURATION_HOURS,
      weeklyHours: row.weekly_hours ?? DEFAULT_WEEKLY_HOURS,
    } satisfies TeamMember;
  });
}
