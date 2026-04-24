CREATE OR REPLACE FUNCTION public.create_membership_invitation(
  p_organization_id uuid,
  p_invited_email text,
  p_role text
)
RETURNS public.memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_membership_id uuid;
  v_actor_role public.membership_role;
  v_code text;
  v_expires_at timestamptz;
  v_invitation public.memberships%ROWTYPE;
  v_invited_email text;
  v_role public.membership_role;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT m.id, m.role
  INTO v_actor_membership_id, v_actor_role
  FROM public.memberships AS m
  WHERE m.organization_id = p_organization_id
    AND m.user_id = v_user_id
    AND m.status = 'active'::public.membership_status
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF v_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'No tenés permisos para invitar miembros.';
  END IF;

  IF p_role IS NULL OR trim(p_role) = '' THEN
    RAISE EXCEPTION 'Debés seleccionar un rol para la invitación.';
  END IF;

  BEGIN
    v_role := lower(trim(p_role))::public.membership_role;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'El rol seleccionado no es válido.';
  END;

  IF NOT public.can_manage_membership_role(v_actor_role, v_role) THEN
    RAISE EXCEPTION 'No tenés permisos para invitar con ese rol.';
  END IF;

  v_invited_email := lower(trim(coalesce(p_invited_email, '')));

  IF v_invited_email = '' THEN
    RAISE EXCEPTION 'Debés ingresar un email para invitar.';
  END IF;

  SELECT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  INTO v_code;
  v_expires_at := now() + interval '14 days';

  INSERT INTO public.memberships (
    organization_id,
    user_id,
    invited_email,
    role,
    status,
    invitation_code,
    invitation_expires_at
  )
  VALUES (
    p_organization_id,
    NULL,
    v_invited_email,
    v_role,
    'invited'::public.membership_status,
    v_code,
    v_expires_at
  )
  ON CONFLICT (organization_id, invited_email)
  WHERE memberships.organization_id IS NOT NULL
    AND memberships.invited_email IS NOT NULL
  DO UPDATE
  SET user_id = NULL,
      role = EXCLUDED.role,
      status = 'invited'::public.membership_status,
      invitation_code = EXCLUDED.invitation_code,
      invitation_expires_at = EXCLUDED.invitation_expires_at,
      updated_at = now()
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$function$;
