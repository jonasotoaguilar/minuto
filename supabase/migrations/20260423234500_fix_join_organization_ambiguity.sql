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
    WHERE memberships.organization_id = v_invitation.organization_id
      AND memberships.user_id = v_user_id
      AND memberships.status = 'active'::public.membership_status
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

DROP POLICY IF EXISTS memberships_select ON public.memberships;

CREATE POLICY memberships_select ON public.memberships
  FOR SELECT TO public
  USING (
    memberships.user_id = (SELECT auth.uid())
    OR (
      memberships.status = 'invited'::public.membership_status
      AND memberships.invited_email IS NOT NULL
      AND lower(memberships.invited_email) = lower(COALESCE((SELECT auth.jwt()) ->> 'email', ''))
    )
    OR public.is_active_member_of_organization(public.memberships.organization_id)
  );

DROP POLICY IF EXISTS organization_offices_select_for_active_members ON public.organization_offices;

CREATE POLICY organization_offices_select_for_active_members ON public.organization_offices
  FOR SELECT TO authenticated
  USING (
    public.is_active_member_of_organization(public.organization_offices.organization_id)
  );
