-- Corrective migration: SECURITY INVOKER conversion + revoke RPC ambiguity fix
-- (F04 part 2b — L01 child PR 3b)
--
-- Two concerns:
--
-- 1. SECURITY INVOKER conversion where existing grants + RLS suffice.
--    Catalog evidence (current trunk): `authenticated` holds SELECT (plus
--    INSERT/UPDATE/DELETE) on organization_offices and RLS policy
--    organization_offices_select_for_active_members (TO authenticated) gates
--    rows to orgs where is_active_member_of_organization(...) is true.
--    get_organization_offices and validate_proximity read EXCLUSIVELY
--    organization_offices, so they can run as INVOKER: RLS becomes the
--    membership gate (wrong-org callers see 0 rows / OUT_OF_RANGE instead of
--    cross-org office data), and the explicit auth.uid() guard rejects
--    unauthenticated callers with a clear error. All other DEFINER RPCs read
--    or write tables where authenticated has no grants; they stay DEFINER
--    until child PR 4 (F05) versioned grants land.
--
--    Preserved: signatures, RETURNS clauses, volatility (VOLATILE, default),
--    `search_path = ''` (child PR 2), owner, and EXECUTE ACLs (PR3a: only
--    authenticated; CREATE OR REPLACE keeps the same OID and grants).
--
-- 2. revoke_membership_invitation 42702 fix. Its RETURNS TABLE declares OUT
--    params (id, organization_id, status); the body's unqualified column
--    references in the actor-role SELECT collide with those OUT params, so
--    PostgreSQL raises 42702 "column reference organization_id is ambiguous"
--    at runtime. Repro on current trunk: calling revoke_membership_invitation
--    on an invited membership raises SQLSTATE 42702. Fix: alias the table
--    (FROM public.memberships AS m) and qualify all colliding columns
--    (m.organization_id, m.user_id, m.status). Authorization checks
--    (auth.uid, owner/admin/manager role, can_manage_membership_role) and
--    business behavior are unchanged.
--
-- Out of scope (documented): create/delete/suspend guard hardening = child
-- PR 3c; table grants + cron parity = child PR 4.
--
-- Rollback: append-only; revert = compensating migration or revert the PR
-- before deploy (file is new, not yet applied anywhere).

-- 1) INVOKER conversion (read only organization_offices; grants + RLS suffice)

CREATE OR REPLACE FUNCTION public.get_organization_offices(p_organization_id uuid)
 RETURNS TABLE(id uuid, name text, address_label text, is_remote boolean, latitude double precision, longitude double precision, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
 SECURITY INVOKER
 SET search_path = ''
AS $function$
DECLARE
  v_office_id uuid;
  v_office_name text;
  v_user_point public.geography;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

-- 2) revoke_membership_invitation: fix 42702 ambiguous column reference

CREATE OR REPLACE FUNCTION public.revoke_membership_invitation(p_membership_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_actor_role public.membership_role;
  v_invitation public.memberships%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.memberships
  WHERE memberships.id = p_membership_id
  FOR UPDATE;

  IF v_invitation.id IS NULL OR v_invitation.status <> 'invited'::public.membership_status THEN
    RAISE EXCEPTION 'La invitación pendiente ya no existe.';
  END IF;

  SELECT role
  INTO v_actor_role
  FROM public.memberships AS m
  WHERE m.organization_id = v_invitation.organization_id
    AND m.user_id = v_user_id
    AND m.status = 'active'::public.membership_status;

  IF v_actor_role IS NULL OR v_actor_role NOT IN (
    'owner'::public.membership_role,
    'admin'::public.membership_role,
    'manager'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para revocar esta invitación.';
  END IF;

  IF NOT public.can_manage_membership_role(v_actor_role, v_invitation.role) THEN
    RAISE EXCEPTION 'No tenés permisos para revocar esta invitación.';
  END IF;

  DELETE FROM public.memberships
  WHERE memberships.id = v_invitation.id;

  RETURN QUERY
  SELECT v_invitation.id,
         v_invitation.organization_id,
         'revoked'::text;
END;
$function$;
