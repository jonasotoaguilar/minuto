-- Migration: shift_management_permissions_and_membership_rpc
-- Grants manager-level org permissions and adds membership shift update RPC.

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
      AND m.role::text IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para modificar esta organización.';
  END IF;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF v_name = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Organization name length must be between 2 and 120 characters';
  END IF;
  IF v_name ~ '[<>]' THEN
    RAISE EXCEPTION 'Organization name contains invalid characters';
  END IF;

  v_default_timezone := trim(coalesce(p_default_timezone, ''));
  IF v_default_timezone = '' THEN
    v_default_timezone := 'America/Santiago';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_timezone_names
    WHERE name = v_default_timezone
  ) THEN
    RAISE EXCEPTION 'Default timezone is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations AS o
    WHERE o.id <> p_organization_id
      AND lower(o.name) = lower(v_name)
      AND o.owner_user_id = (
        SELECT owner_user_id
        FROM public.organizations
        WHERE id = p_organization_id
      )
  ) THEN
    RAISE EXCEPTION 'Ya existe una organización con ese nombre.';
  END IF;

  UPDATE public.organizations
  SET default_timezone = v_default_timezone,
      name = v_name
  WHERE id = p_organization_id
  RETURNING * INTO v_organization;

  IF v_organization.id IS NULL THEN
    RAISE EXCEPTION 'La organización no existe.';
  END IF;

  RETURN v_organization;
END;
$$;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = v_user_id
      AND m.status = 'active'::public.membership_status
      AND m.role::text IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para crear oficinas en esta organización.';
  END IF;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF v_name = '' THEN
    RAISE EXCEPTION 'Office name is required';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Office name length must be between 2 and 120 characters';
  END IF;
  IF v_name ~ '[<>]' THEN
    RAISE EXCEPTION 'Office name contains invalid characters';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'Office coordinates must include both latitude and longitude';
  END IF;

  IF p_latitude < -90 OR p_latitude > 90 THEN
    RAISE EXCEPTION 'Office latitude must be between -90 and 90';
  END IF;

  IF p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Office longitude must be between -180 and 180';
  END IF;

  v_address_label := NULLIF(
    regexp_replace(trim(coalesce(p_address_label, '')), '\s+', ' ', 'g'),
    ''
  );

  IF v_address_label IS NOT NULL THEN
    IF length(v_address_label) < 3 OR length(v_address_label) > 180 THEN
      RAISE EXCEPTION 'Office address label length must be between 3 and 180 characters';
    END IF;
    IF v_address_label ~ '[<>]' THEN
      RAISE EXCEPTION 'Office address label contains invalid characters';
    END IF;
  END IF;

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
    extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_longitude, p_latitude),
      4326
    )::extensions.geography,
    false
  )
  RETURNING * INTO v_office;

  RETURN v_office;
END;
$$;

DROP POLICY IF EXISTS organization_offices_insert_for_owner_admin ON public.organization_offices;
DROP POLICY IF EXISTS organization_offices_update_for_owner_admin ON public.organization_offices;
DROP POLICY IF EXISTS organization_offices_delete_for_owner_admin ON public.organization_offices;
DROP POLICY IF EXISTS organization_offices_insert_for_management ON public.organization_offices;
DROP POLICY IF EXISTS organization_offices_update_for_management ON public.organization_offices;
DROP POLICY IF EXISTS organization_offices_delete_for_management ON public.organization_offices;

CREATE POLICY organization_offices_insert_for_management
  ON public.organization_offices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'::public.membership_status
        AND m.role::text IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY organization_offices_update_for_management
  ON public.organization_offices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'::public.membership_status
        AND m.role::text IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'::public.membership_status
        AND m.role::text IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY organization_offices_delete_for_management
  ON public.organization_offices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'::public.membership_status
        AND m.role::text IN ('owner', 'admin', 'manager')
    )
  );

DROP FUNCTION IF EXISTS public.update_membership_shift(uuid, numeric, numeric);

CREATE FUNCTION public.update_membership_shift(
  p_membership_id uuid,
  p_shift_duration_hours numeric,
  p_break_duration_hours numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_shift_duration_hours IS NULL
     OR p_shift_duration_hours <= 0
     OR p_shift_duration_hours > 24 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_SHIFT_DURATION'
    );
  END IF;

  IF p_break_duration_hours IS NULL
     OR p_break_duration_hours < 0
     OR p_break_duration_hours >= p_shift_duration_hours THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_BREAK_DURATION'
    );
  END IF;

  SELECT m.organization_id
  INTO v_organization_id
  FROM public.memberships AS m
  WHERE m.id = p_membership_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'MEMBERSHIP_NOT_FOUND'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.organization_id = v_organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status
      AND m.role::text IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: insufficient membership permissions';
  END IF;

  UPDATE public.memberships
  SET
    shift_duration_hours = p_shift_duration_hours,
    break_duration_hours = p_break_duration_hours
  WHERE id = p_membership_id;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'shift_duration_hours', p_shift_duration_hours,
    'break_duration_hours', p_break_duration_hours
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_membership_shift(uuid, numeric, numeric) TO authenticated;
