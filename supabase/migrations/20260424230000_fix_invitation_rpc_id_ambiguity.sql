CREATE OR REPLACE FUNCTION public.create_membership_invitation(
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
  v_membership public.memberships%ROWTYPE;
  v_organization public.organizations%ROWTYPE;
  v_invited_email text;
  v_normalized_role public.membership_role;
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
      WHERE invitation_code = v_generated_code
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

CREATE OR REPLACE FUNCTION public.accept_membership_invitation(
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
  v_user_email text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  IF v_user_email = '' THEN
    RAISE EXCEPTION 'Tu usuario autenticado no tiene email disponible.';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.memberships
  WHERE invitation_code = upper(trim(coalesce(p_invitation_code, '')))
  FOR UPDATE;

  IF v_invitation.id IS NULL OR v_invitation.status <> 'invited'::public.membership_status THEN
    RAISE EXCEPTION 'Invitación no encontrada o vencida.';
  END IF;

  IF v_invitation.invited_email IS NULL OR lower(v_invitation.invited_email) <> v_user_email THEN
    RAISE EXCEPTION 'Esta invitación no corresponde a tu email.';
  END IF;

  IF v_invitation.invitation_expires_at IS NOT NULL
    AND v_invitation.invitation_expires_at < now() THEN
    RAISE EXCEPTION 'La invitación está vencida.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE organization_id = v_invitation.organization_id
      AND user_id = v_user_id
      AND status = 'active'::public.membership_status
      AND memberships.id <> v_invitation.id
  ) THEN
    RAISE EXCEPTION 'Ya pertenecés a esta organización.';
  END IF;

  UPDATE public.memberships
  SET user_id = v_user_id,
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

CREATE OR REPLACE FUNCTION public.revoke_membership_invitation(
  p_membership_id uuid
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  FROM public.memberships
  WHERE organization_id = v_invitation.organization_id
    AND user_id = v_user_id
    AND status = 'active'::public.membership_status;

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
