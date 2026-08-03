-- Corrective migration: harden SECURITY DEFINER search_path (F04)
--
-- Root cause (audit F04): every project-owned SECURITY DEFINER function in
-- `public` runs with `SET search_path TO 'public'`. A writable search-path
-- schema lets a role that can CREATE objects in `public` hijack unqualified
-- references (tables, functions, operators) inside DEFINER bodies, which run
-- with the definer's privileges (postgres). ARCHITECTURE.md requires
-- `SET search_path = ''` plus fully qualified references.
--
-- Approach (smallest corrective change, behavior-preserving):
--   1. ALTER FUNCTION ... SET search_path = '' for the 24 functions whose
--      bodies are already fully qualified (all tables `public.*`, all
--      non-builtin calls `auth.*`/`extensions.*`, remaining references
--      resolve to pg_catalog, which is always implicitly searched first).
--      ALTER touches only proconfig: body, signature, owner, volatility,
--      security mode, and EXECUTE grants are all preserved verbatim.
--   2. CREATE OR REPLACE for the 2 functions whose bodies reference the
--      `organization_offices` table WITHOUT schema qualification
--      (get_organization_offices, validate_proximity). These would fail at
--      runtime under an empty search_path; the rewrite qualifies the table
--      and sets `search_path = ''`. Signature, volatility (VOLATILE,
--      default), SECURITY DEFINER, owner, and grants are preserved.
--
-- Volatility note: `is_active_member_of_organization` is STABLE; it is
-- handled by ALTER only, so its volatility is untouched by construction.
--
-- Out of scope (documented, not project-owned):
--   - public.st_estimatedextent (3 overloads): postgis extension members,
--     owned by supabase_admin; extension-managed, never edited by L01.
--   - pgbouncer.get_auth, vault.*, supabase_functions.http_request:
--     system/extension schemas, already `search_path = ""`.
--   - EXECUTE revocation / SECURITY INVOKER conversion / auth.uid() guards:
--     L01 child PR 3.
--
-- Rollback: this migration is append-only. Revert = delete the file (not yet
-- applied anywhere) or a compensating migration on deployed environments.

-- 1) Hardened bodies: set empty search_path (24 functions)

ALTER FUNCTION public.accept_membership_invitation(text) SET search_path = '';

ALTER FUNCTION public.attendance_clock_in(uuid, uuid, date, double precision, double precision, double precision, uuid, boolean) SET search_path = '';

ALTER FUNCTION public.attendance_clock_out(uuid, double precision, double precision, double precision, boolean, timestamp with time zone, boolean) SET search_path = '';

ALTER FUNCTION public.auto_close_stale_shifts() SET search_path = '';

ALTER FUNCTION public.create_membership_invitation(uuid, text, text) SET search_path = '';

ALTER FUNCTION public.create_organization_office(uuid, text, text, double precision, double precision) SET search_path = '';

ALTER FUNCTION public.create_organization_with_owner(text, text, text, text, text, double precision, double precision) SET search_path = '';

ALTER FUNCTION public.delete_expired_membership_invitations() SET search_path = '';

ALTER FUNCTION public.delete_membership(uuid) SET search_path = '';

ALTER FUNCTION public.get_attendance_history_page(uuid, uuid, integer, integer, integer, integer) SET search_path = '';

ALTER FUNCTION public.get_attendance_records(uuid, uuid, date, date) SET search_path = '';

ALTER FUNCTION public.get_open_shift(uuid) SET search_path = '';

ALTER FUNCTION public.get_organization_team_members(uuid) SET search_path = '';

ALTER FUNCTION public.handle_new_user_profile() SET search_path = '';

ALTER FUNCTION public.is_active_member_of_organization(uuid) SET search_path = '';

ALTER FUNCTION public.list_my_membership_invitations(text) SET search_path = '';

ALTER FUNCTION public.list_pending_membership_invitations(uuid) SET search_path = '';

ALTER FUNCTION public.revoke_membership_invitation(uuid) SET search_path = '';

ALTER FUNCTION public.rls_auto_enable() SET search_path = '';

ALTER FUNCTION public.suspend_membership(uuid) SET search_path = '';

ALTER FUNCTION public.update_employee_profile(uuid, numeric, numeric, text, text, date) SET search_path = '';

ALTER FUNCTION public.update_employee_profile(uuid, numeric, numeric, text, text, date, numeric) SET search_path = '';

ALTER FUNCTION public.update_membership_role(uuid, text) SET search_path = '';

ALTER FUNCTION public.update_organization_settings(uuid, text, text) SET search_path = '';

-- 2) Bodies with an unqualified table reference: qualify + empty search_path

CREATE OR REPLACE FUNCTION public.get_organization_offices(p_organization_id uuid)
 RETURNS TABLE(id uuid, name text, address_label text, is_remote boolean, latitude double precision, longitude double precision, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    oo.id,
    oo.name,
    oo.address_label,
    oo.is_remote,
    extensions.ST_Y(oo.location_point::public.geometry) as latitude,
    extensions.ST_X(oo.location_point::public.geometry) as longitude,
    oo.organization_id
  FROM public.organization_offices oo
  WHERE oo.organization_id = p_organization_id
    AND oo.is_remote = false
  ORDER BY oo.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_proximity(p_organization_id uuid, p_latitude double precision, p_longitude double precision, p_accuracy double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_office_id uuid;
  v_office_name text;
  v_user_point public.geography;
BEGIN
  IF p_accuracy > 50 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'GPS_ACCURACY_TOO_LOW'
    );
  END IF;

  v_user_point := extensions.ST_SetSRID(
    extensions.ST_MakePoint(p_longitude, p_latitude),
    4326
  )::public.geography;

  SELECT id, name
  INTO v_office_id, v_office_name
  FROM public.organization_offices
  WHERE organization_id = p_organization_id
    AND is_remote = false
    AND extensions.ST_DWithin(location_point, v_user_point, 100)
  ORDER BY extensions.ST_Distance(location_point, v_user_point) ASC
  LIMIT 1;

  IF v_office_id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'OUT_OF_RANGE'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'office_id', v_office_id,
    'office_name', v_office_name
  );
END;
$function$;
