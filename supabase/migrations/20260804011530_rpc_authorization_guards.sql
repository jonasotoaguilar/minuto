-- Corrective migration: explicit authorization guards (F04 part 2c — L01 child PR 3c)
--
-- Explicit authorization guards on the three RPCs that previously had NO
-- caller checks at all (verified against the live catalog on current trunk
-- 2cbb20e):
--    - create_membership_invitation: any authenticated user could create an
--      invitation for ANY organization. Now requires an active
--      owner/admin/manager membership in the target org AND a role the caller
--      is allowed to assign (can_manage_membership_role). Guard runs before
--      the org-existence lookup, so org existence is not leaked to
--      unauthorized callers.
--    - delete_membership / suspend_membership: any authenticated user could
--      delete or suspend ANY membership. Now require an active
--      owner/admin/manager membership in the target membership's org AND
--      can_manage_membership_role over the target role. This also blocks
--      self-modification (can_manage_membership_role(x, x) is false for every
--      role) and owner escalation (target role owner is always denied).
--
-- OUT-param safety: create_membership_invitation RETURNS TABLE declares OUT
-- params (role, status, organization_id) that shadow memberships columns of
-- the same name; all guard queries therefore use the aliased table (AS m)
-- with fully qualified column references (same 42702 class fixed for
-- revoke_membership_invitation in child PR 3b).
--
-- Behavior preservation: signatures, RETURNS clauses, volatility (VOLATILE,
-- default), `search_path = ''` (child PR 2), SECURITY DEFINER (unchanged;
-- child PR 3b INVOKER conversion applies only to the two offices-only RPCs),
-- owner, EXECUTE ACLs (child PR 3a — this migration contains no REVOKE/GRANT
-- statements), and client contracts: happy-path payloads are byte-identical
-- ({success: true, membership_id, status} for suspend; {success: true,
-- membership_id} for delete; the full invitation row for create). Unauthorized
-- and missing-target paths raise/return errors instead of silently acting.
--
-- Out of scope (documented): EXECUTE ACLs = child PR 3a (merged); INVOKER +
-- revoke fix = child PR 3b (merged); table grants + cron parity = child PR 4.
--
-- Rollback: append-only; revert = compensating migration or revert the PR
-- before deploy (file is new, not yet applied anywhere).

-- 1) create_membership_invitation: add caller authorization guard

CREATE OR REPLACE FUNCTION public.create_membership_invitation(p_organization_id uuid, p_invited_email text, p_role text)
 RETURNS TABLE(id uuid, organization_id uuid, organization_name text, invited_email text, role membership_role, status membership_status, invitation_code text, invitation_expires_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_generated_code text;
  v_membership public.memberships%ROWTYPE;
  v_organization public.organizations%ROWTYPE;
  v_invited_email text;
  v_normalized_role public.membership_role;
  v_actor_role public.membership_role;
  v_user_id uuid;
BEGIN
  v_invited_email := lower(trim(coalesce(p_invited_email, '')));

  IF v_invited_email = '' OR v_invited_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'El email invitado no es válido.';
  END IF;

  IF length(v_invited_email) > 254 THEN
    RAISE EXCEPTION 'El email invitado no es válido.';
  END IF;

  BEGIN
    v_normalized_role := lower(trim(coalesce(p_role, '')))::public.membership_role;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'El rol invitado no es válido.';
  END;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT m.role
  INTO v_actor_role
  FROM public.memberships AS m
  WHERE m.organization_id = p_organization_id
    AND m.user_id = v_user_id
    AND m.status = 'active'::public.membership_status;

  IF v_actor_role IS NULL OR v_actor_role NOT IN (
    'owner'::public.membership_role,
    'admin'::public.membership_role,
    'manager'::public.membership_role
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para invitar en esta organización.';
  END IF;

  IF NOT public.can_manage_membership_role(v_actor_role, v_normalized_role) THEN
    RAISE EXCEPTION 'No tenés permisos para asignar ese rol.';
  END IF;

  SELECT *
  INTO v_organization
  FROM public.organizations
  WHERE organizations.id = p_organization_id;

  IF v_organization.id IS NULL THEN
    RAISE EXCEPTION 'La organización no existe.';
  END IF;

  SELECT *
  INTO v_membership
  FROM public.memberships
  WHERE memberships.organization_id = p_organization_id
    AND memberships.invited_email IS NOT NULL
    AND lower(memberships.invited_email) = v_invited_email
  FOR UPDATE;

  IF v_membership.id IS NOT NULL
    AND v_membership.status = 'active'::public.membership_status THEN
    RAISE EXCEPTION 'Ese email ya pertenece a la organización.';
  END IF;

  LOOP
    v_generated_code := upper(substring(replace(gen_random_uuid()::text,'-',''),1,12));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.invitation_code = v_generated_code
    );
  END LOOP;

  IF v_membership.id IS NULL THEN
    INSERT INTO public.memberships (
      organization_id,
      invited_email,
      role,
      status,
      invitation_code,
      invitation_expires_at,
      user_id
    )
    VALUES (
      p_organization_id,
      v_invited_email,
      v_normalized_role,
      'invited'::public.membership_status,
      v_generated_code,
      now() + interval '7 days',
      NULL
    )
    RETURNING * INTO v_membership;
  ELSE
    UPDATE public.memberships
    SET invited_email = v_invited_email,
        invitation_code = v_generated_code,
        invitation_expires_at = now() + interval '7 days',
        role = v_normalized_role,
        status = 'invited'::public.membership_status,
        user_id = coalesce(memberships.user_id, NULL)
    WHERE memberships.id = v_membership.id
    RETURNING * INTO v_membership;
  END IF;

  RETURN QUERY
  SELECT v_membership.id,
         v_membership.organization_id,
         v_organization.name,
         v_membership.invited_email,
         v_membership.role,
         v_membership.status,
         v_membership.invitation_code,
         v_membership.invitation_expires_at,
         v_membership.created_at;
END;
$function$;

-- 2) delete_membership: add caller authorization guard

CREATE OR REPLACE FUNCTION public.delete_membership(p_membership_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_actor_role public.membership_role;
  v_target_org_id uuid;
  v_target_role public.membership_role;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.organization_id, m.role
  INTO v_target_org_id, v_target_role
  FROM public.memberships AS m
  WHERE m.id = p_membership_id;

  IF v_target_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MEMBERSHIP_NOT_FOUND');
  END IF;

  SELECT m.role
  INTO v_actor_role
  FROM public.memberships AS m
  WHERE m.organization_id = v_target_org_id
    AND m.user_id = v_user_id
    AND m.status = 'active'::public.membership_status;

  IF v_actor_role IS NULL OR NOT public.can_manage_membership_role(v_actor_role, v_target_role) THEN
    RAISE EXCEPTION 'No tenés permisos para eliminar este miembro.';
  END IF;

  DELETE FROM public.memberships
  WHERE memberships.id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id);
END;
$function$;

-- 3) suspend_membership: add caller authorization guard

CREATE OR REPLACE FUNCTION public.suspend_membership(p_membership_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_actor_role public.membership_role;
  v_target_org_id uuid;
  v_target_role public.membership_role;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.organization_id, m.role
  INTO v_target_org_id, v_target_role
  FROM public.memberships AS m
  WHERE m.id = p_membership_id;

  IF v_target_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MEMBERSHIP_NOT_FOUND');
  END IF;

  SELECT m.role
  INTO v_actor_role
  FROM public.memberships AS m
  WHERE m.organization_id = v_target_org_id
    AND m.user_id = v_user_id
    AND m.status = 'active'::public.membership_status;

  IF v_actor_role IS NULL OR NOT public.can_manage_membership_role(v_actor_role, v_target_role) THEN
    RAISE EXCEPTION 'No tenés permisos para suspender este miembro.';
  END IF;

  UPDATE public.memberships
  SET status = 'suspended'::public.membership_status
  WHERE memberships.id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id, 'status', 'suspended');
END;
$function$;
