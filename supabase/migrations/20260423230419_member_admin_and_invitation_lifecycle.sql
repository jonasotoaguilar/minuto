DROP FUNCTION IF EXISTS public.accept_membership_invitation(text);

CREATE FUNCTION public.accept_membership_invitation(
  p_invitation_code text
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  organization_name text,
  role public.membership_role,
  status public.membership_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation public.memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
  FROM public.memberships
  WHERE memberships.invitation_code = upper(trim(coalesce(p_invitation_code, '')))
  FOR UPDATE;

  UPDATE public.memberships
  SET user_id = auth.uid(),
      status = 'active'::public.membership_status,
      invitation_code = NULL,
      invitation_expires_at = NULL
  WHERE memberships.id = v_invitation.id
  RETURNING * INTO v_invitation;

  INSERT INTO public.employee_profiles (membership_id, position, department, hire_date)
  VALUES (v_invitation.id, 'General', 'General', current_date)
  ON CONFLICT (membership_id)
  DO UPDATE SET
    position = coalesce(nullif(trim(employee_profiles.position), ''), 'General'),
    department = coalesce(nullif(trim(employee_profiles.department), ''), 'General'),
    hire_date = coalesce(employee_profiles.hire_date, current_date);

  RETURN QUERY
  SELECT v_invitation.id,
         v_invitation.organization_id,
         organizations.name,
         v_invitation.role,
         v_invitation.status
  FROM public.organizations
  WHERE organizations.id = v_invitation.organization_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_membership_invitations(
  p_invitation_code text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  organization_name text,
  invited_email text,
  role public.membership_role,
  status public.membership_status,
  invitation_code text,
  invitation_expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT memberships.id,
         memberships.organization_id,
         organizations.name,
         memberships.invited_email,
         memberships.role,
         memberships.status,
         memberships.invitation_code,
         memberships.invitation_expires_at,
         memberships.created_at
  FROM public.memberships
  JOIN public.organizations ON organizations.id = memberships.organization_id
  WHERE memberships.status = 'invited'::public.membership_status
    AND lower(memberships.invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (
      memberships.invitation_expires_at IS NULL
      OR memberships.invitation_expires_at >= now()
    )
  ORDER BY
    CASE
      WHEN upper(trim(coalesce(p_invitation_code, ''))) <> ''
        AND memberships.invitation_code = upper(trim(coalesce(p_invitation_code, '')))
      THEN 0
      ELSE 1
    END,
    memberships.created_at DESC;
END;
$function$;

DROP FUNCTION IF EXISTS public.create_membership_invitation(uuid, text, text);

CREATE FUNCTION public.create_membership_invitation(
  p_organization_id uuid,
  p_invited_email text,
  p_role text
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  organization_name text,
  invited_email text,
  role public.membership_role,
  status public.membership_status,
  invitation_code text,
  invitation_expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_generated_code text;
  v_existing_invitation_code text;
  v_membership public.memberships%ROWTYPE;
BEGIN
  SELECT memberships.invitation_code
  INTO v_existing_invitation_code
  FROM public.memberships
  WHERE memberships.organization_id = p_organization_id
    AND lower(memberships.invited_email) = lower(trim(coalesce(p_invited_email, '')))
  LIMIT 1;

  IF v_existing_invitation_code IS NULL THEN
    v_generated_code := upper(encode(gen_random_bytes(10), 'hex'));
  ELSE
    v_generated_code := v_existing_invitation_code;
  END IF;

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
    lower(trim(coalesce(p_invited_email, ''))),
    lower(trim(coalesce(p_role, '')))::public.membership_role,
    'invited'::public.membership_status,
    v_generated_code,
    now() + interval '7 days',
    NULL
  )
  ON CONFLICT (organization_id, invited_email) WHERE invited_email IS NOT NULL
  DO UPDATE SET
    role = EXCLUDED.role,
    status = 'invited'::public.membership_status,
    invitation_code = CASE
      WHEN memberships.invitation_code IS NULL THEN EXCLUDED.invitation_code
      ELSE memberships.invitation_code
    END,
    invitation_expires_at = now() + interval '7 days',
    user_id = NULL
  RETURNING * INTO v_membership;

  RETURN QUERY
  SELECT v_membership.id,
         v_membership.organization_id,
         organizations.name,
         v_membership.invited_email,
         v_membership.role,
         v_membership.status,
         v_membership.invitation_code,
         v_membership.invitation_expires_at,
         v_membership.created_at
  FROM public.organizations
  WHERE organizations.id = v_membership.organization_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.suspend_membership(
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.memberships
  SET status = 'suspended'::public.membership_status
  WHERE memberships.id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id, 'status', 'suspended');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_membership(
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.memberships
  WHERE memberships.id = p_membership_id;

  RETURN jsonb_build_object('success', true, 'membership_id', p_membership_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_expired_membership_invitations()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_count bigint := 0;
BEGIN
  DELETE FROM public.memberships
  WHERE memberships.status = 'invited'::public.membership_status
    AND memberships.invitation_expires_at IS NOT NULL
    AND memberships.invitation_expires_at < now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$function$;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid INTO v_job_id
    FROM cron.job
    WHERE jobname = 'cleanup-expired-membership-invitations'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'cleanup-expired-membership-invitations',
      '0 * * * *',
      $cron$SELECT public.delete_expired_membership_invitations()$cron$
    );
  END IF;
END
$$;
