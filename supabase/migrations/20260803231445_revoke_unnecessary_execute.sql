-- Corrective migration: revoke unnecessary EXECUTE privileges (F04 part 2)
--
-- Root cause (audit F04): every project-owned function in `public` defaults to
-- PUBLIC EXECUTE, so `anon` and `authenticated` (both members of PUBLIC) can
-- invoke every RPC, including maintenance functions and DEFINER helpers. The
-- live remote ACLs confirm anon EXECUTE on all 26 DEFINER functions.
--
-- Approach (least privilege, client contract preserved):
--   1. REVOKE ALL ... FROM PUBLIC first, then explicitly from `anon`, so no
--      hidden PUBLIC exposure survives; explicit role grants come after.
--   2. GRANT EXECUTE ... TO authenticated ONLY for RPCs the app client calls
--      (call sites verified: src/lib/attendance.ts, src/lib/organization-
--      invitations.ts, src/hooks/use-organization*.ts, src/app/team.tsx,
--      src/app/org-settings.tsx). service_role: explicit service_role grants
--      are preserved, while PUBLIC-derived EXECUTE is intentionally removed
--      (the REVOKE ... FROM PUBLIC above also strips service_role's implicit
--      PUBLIC access). Prior to this migration, only
--      create_organization_with_owner carried an explicit service_role grant
--      in the catalog, and no repository consumers (client code, edge
--      functions, cron) require broader service_role EXECUTE; if a future
--      server-side caller needs it, add an explicit GRANT per function.
--      (This migration itself adds service_role only where RLS policy
--      evaluation requires it: is_active_member_of_organization.)
--   3. Maintenance/cron and trigger/event-trigger helpers keep EXECUTE only
--      for postgres (cron jobs run as postgres; event trigger fires as
--      postgres) plus supabase_auth_admin for the auth.users trigger.
--   4. is_active_member_of_organization must KEEP anon+authenticated EXECUTE:
--      RLS policies (memberships_select, organization_offices_*) call it as
--      the querying role, so revoking would break policy evaluation.
--
-- Out of scope (documented):
--   - set_updated_at(): SECURITY INVOKER trigger helper (no privilege
--     escalation surface; triggers fire as postgres) — untouched.
--   - can_manage_membership_role(): already postgres-only (REVOKE ALL FROM
--     PUBLIC in 20260401153000) — untouched.
--   - public.st_estimatedextent (3 overloads): postgis extension members —
--     untouched.
--   - Table grants for anon/authenticated: L01 child PR 4 (F05). Until those
--     land, INVOKER conversion is limited to functions reading only
--     organization_offices (see invoker_conversion_and_rpc_guards migration).
--
-- Rollback: append-only; revert = compensating migration or revert the PR
-- before deploy (these files are new, not yet applied anywhere).

-- Client RPCs: authenticated only

REVOKE ALL ON FUNCTION public.accept_membership_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_membership_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.attendance_clock_in(uuid, uuid, date, double precision, double precision, double precision, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_clock_in(uuid, uuid, date, double precision, double precision, double precision, uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.attendance_clock_out(uuid, double precision, double precision, double precision, boolean, timestamp with time zone, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_clock_out(uuid, double precision, double precision, double precision, boolean, timestamp with time zone, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.create_membership_invitation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_membership_invitation(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_organization_office(uuid, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_office(uuid, text, text, double precision, double precision) TO authenticated;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text, text, text, text, double precision, double precision) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_membership(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_attendance_history_page(uuid, uuid, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_history_page(uuid, uuid, integer, integer, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_attendance_records(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_records(uuid, uuid, date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.get_open_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_open_shift(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_organization_offices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_organization_offices(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_organization_team_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_organization_team_members(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_membership_invitations(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_membership_invitations(text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_pending_membership_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_membership_invitations(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_membership_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_membership_invitation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.suspend_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_membership(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_employee_profile(uuid, numeric, numeric, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_employee_profile(uuid, numeric, numeric, text, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.update_employee_profile(uuid, numeric, numeric, text, text, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_employee_profile(uuid, numeric, numeric, text, text, date, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.update_membership_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_membership_role(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_organization_settings(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_organization_settings(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_proximity(uuid, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_proximity(uuid, double precision, double precision, double precision) TO authenticated;

-- Cron maintenance (runs as postgres): no client surface

REVOKE ALL ON FUNCTION public.auto_close_stale_shifts() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.delete_expired_membership_invitations() FROM PUBLIC, anon, authenticated;

-- Trigger on auth.users (fires as supabase_auth_admin) and event-trigger helper

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO supabase_auth_admin;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- RLS-policy-referenced helper: must stay executable by roles that evaluate
-- policies (memberships_select, organization_offices_select_for_active_members)

REVOKE ALL ON FUNCTION public.is_active_member_of_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_member_of_organization(uuid) TO anon, authenticated, service_role;
