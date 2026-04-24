CREATE OR REPLACE FUNCTION public.update_organization_settings(
  p_organization_id uuid,
  p_name text,
  p_default_timezone text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_timezone text;
  v_name text;
  v_organization public.organizations%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = v_user_id
      AND m.status = 'active'::public.membership_status
      AND m.role IN ('owner'::public.membership_role, 'admin'::public.membership_role)
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para modificar esta organización.';
  END IF;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_default_timezone := trim(coalesce(p_default_timezone, ''));
  IF v_default_timezone = '' THEN
    v_default_timezone := 'America/Santiago';
  END IF;

  UPDATE public.organizations
  SET default_timezone = v_default_timezone,
      name = v_name
  WHERE id = p_organization_id
  RETURNING * INTO v_organization;

  RETURN v_organization;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_organization_settings(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_organization_office(
  p_organization_id uuid,
  p_name text,
  p_address_label text,
  p_latitude double precision,
  p_longitude double precision
)
RETURNS public.organization_offices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_address_label text;
  v_name text;
  v_office public.organization_offices%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_address_label := NULLIF(regexp_replace(trim(coalesce(p_address_label, '')), '\s+', ' ', 'g'), '');

  INSERT INTO public.organization_offices (
    organization_id,
    name,
    address_label,
    location_point,
    is_remote
  )
  VALUES (
    p_organization_id,
    v_name,
    v_address_label,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    false
  )
  RETURNING * INTO v_office;

  RETURN v_office;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_office(uuid, text, text, double precision, double precision) TO authenticated;
