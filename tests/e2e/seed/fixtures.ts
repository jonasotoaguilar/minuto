import { execSync } from 'node:child_process';

import type { TestUser } from '../helpers';

/**
 * Deterministic fixtures for the E2E seed: the seed user owns a fixed
 * organization with an office and attendance history, so login and
 * navigation specs never depend on app-created values.
 */
export const SEED_USER: TestUser = {
  email: 'e2e.seed@minuto.test',
  fullName: 'E2E Seed User',
  password: 'TestPassword123',
  phone: '+56987654321',
};

export const SEED_ORG_NAME = 'E2E Determinista SpA';
export const SEED_ORG_TIMEZONE = 'America/Santiago';
export const SEED_OFFICE_NAME = 'Sucursal E2E';
export const SEED_ATTENDANCE_DAYS = 6;

export interface LocalSupabaseEnv {
  apiUrl: string;
  serviceRoleKey: string;
}

/**
 * Reads the local stack connection values from `supabase status -o env`.
 */
export function getLocalSupabaseEnv(): LocalSupabaseEnv {
  const raw = execSync('supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const apiUrl = /^API_URL="(.*)"$/m.exec(raw)?.[1];
  const serviceRoleKey = /^SERVICE_ROLE_KEY="(.*)"$/m.exec(raw)?.[1];

  if (!apiUrl || !serviceRoleKey) {
    throw new Error(
      'Local Supabase stack is not running. Start it before running E2E tests.',
    );
  }

  return { apiUrl, serviceRoleKey };
}

/** SQL that deletes every fixture row owned by the seed user (idempotent). */
export function resetSeedUserSql(userId: string): string {
  return `do $$
declare
  org_ids uuid[];
begin
  select array_agg(id) into org_ids
  from public.organizations where owner_user_id = '${userId}';
  if org_ids is null then
    return;
  end if;
  delete from public.attendance_records where organization_id = any(org_ids);
  delete from public.employee_profiles
  where membership_id in (
    select id from public.memberships where organization_id = any(org_ids)
  );
  delete from public.organization_offices where organization_id = any(org_ids);
  delete from public.memberships where organization_id = any(org_ids);
  delete from public.organizations where id = any(org_ids);
end $$;
`;
}

/**
 * SQL that inserts the deterministic org, owner membership, employee profile,
 * remote office and a closed attendance record for every day of the window
 * (weekends included), so today always has a record regardless of the
 * calendar date the suite runs on.
 */
export function seedUserSql(userId: string): string {
  return `
with org as (
  insert into public.organizations (
    name, plan, default_timezone, owner_user_id
  )
  values (
    '${SEED_ORG_NAME}', 'free', '${SEED_ORG_TIMEZONE}', '${userId}'
  )
  returning id
),
membership as (
  insert into public.memberships (organization_id, user_id, role, status)
  select id, '${userId}', 'owner', 'active' from org
  returning id, organization_id
),
profile as (
  insert into public.employee_profiles (membership_id, position, department, hire_date)
  select id, 'Dueño', 'Dirección', current_date - 60 from membership
),
office as (
  insert into public.organization_offices (organization_id, name, is_remote)
  select organization_id, '${SEED_OFFICE_NAME}', true from membership
  returning id
)
insert into public.attendance_records (
  organization_id, membership_id, office_id, work_date, clock_in_at, clock_out_at
)
select
  membership.organization_id,
  membership.id,
  office.id,
  day::date as work_date,
  (day + time '09:00') at time zone '${SEED_ORG_TIMEZONE}' as clock_in_at,
  (day + time '18:00') at time zone '${SEED_ORG_TIMEZONE}' as clock_out_at
from membership
cross join office,
  generate_series(
    current_date - ${SEED_ATTENDANCE_DAYS},
    current_date,
    interval '1 day'
  ) as day;
`;
}
