-- Migration: remove_organization_timezone
-- Drops org-level timezone persistence and stops requiring it during org creation.

DROP FUNCTION IF EXISTS public.create_organization_with_owner(
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision
);

CREATE FUNCTION public.create_organization_with_owner(
  p_name text,
  p_location text DEFAULT NULL::text,
  p_office_name text DEFAULT NULL::text,
  p_office_address_label text DEFAULT NULL::text,
  p_office_latitude double precision DEFAULT NULL::double precision,
  p_office_longitude double precision DEFAULT NULL::double precision
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
  v_name text;
  v_office_name text;
  v_office_address_label text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

  IF (p_office_latitude IS NULL) <> (p_office_longitude IS NULL) THEN
    RAISE EXCEPTION 'Office coordinates must include both latitude and longitude';
  END IF;

  IF p_office_latitude IS NOT NULL THEN
    IF p_office_latitude < -90 OR p_office_latitude > 90 THEN
      RAISE EXCEPTION 'Office latitude must be between -90 and 90';
    END IF;
    IF p_office_longitude < -180 OR p_office_longitude > 180 THEN
      RAISE EXCEPTION 'Office longitude must be between -180 and 180';
    END IF;

    v_office_name := NULLIF(
      regexp_replace(trim(coalesce(p_office_name, '')), '\s+', ' ', 'g'),
      ''
    );
    IF v_office_name IS NULL THEN
      RAISE EXCEPTION 'Office name is required when coordinates are provided';
    END IF;
    IF length(v_office_name) < 2 OR length(v_office_name) > 120 THEN
      RAISE EXCEPTION 'Office name length must be between 2 and 120 characters';
    END IF;
    IF v_office_name ~ '[<>]' THEN
      RAISE EXCEPTION 'Office name contains invalid characters';
    END IF;

    v_office_address_label := NULLIF(
      regexp_replace(
        trim(coalesce(p_office_address_label, p_location, '')),
        '\s+',
        ' ',
        'g'
      ),
      ''
    );
    IF v_office_address_label IS NOT NULL THEN
      IF length(v_office_address_label) < 3 OR length(v_office_address_label) > 180 THEN
        RAISE EXCEPTION 'Office address label length must be between 3 and 180 characters';
      END IF;
      IF v_office_address_label ~ '[<>]' THEN
        RAISE EXCEPTION 'Office address label contains invalid characters';
      END IF;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations AS o
    WHERE o.owner_user_id = v_user_id
      AND lower(o.name) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Ya existe una organización con ese nombre.';
  END IF;

  INSERT INTO public.organizations (name, plan, owner_user_id)
  VALUES (v_name, 'free', v_user_id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user_id, 'owner', 'active')
  RETURNING id INTO v_membership_id;

  INSERT INTO public.employee_profiles (membership_id, position, department, hire_date)
  VALUES (v_membership_id, 'CEO', 'Administración', current_date)
  ON CONFLICT (membership_id)
  DO UPDATE
    SET position = excluded.position,
        department = excluded.department,
        hire_date = excluded.hire_date,
        updated_at = now();

  INSERT INTO public.organization_offices (
    organization_id,
    name,
    address_label,
    location_point,
    is_remote
  )
  VALUES (
    v_org_id,
    'Remote',
    NULL,
    NULL,
    true
  );

  IF p_office_latitude IS NOT NULL THEN
    INSERT INTO public.organization_offices (
      organization_id,
      name,
      address_label,
      location_point,
      is_remote
    )
    VALUES (
      v_org_id,
      v_office_name,
      v_office_address_label,
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(p_office_longitude, p_office_latitude),
        4326
      )::extensions.geography,
      false
    );
  END IF;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(
  text,
  text,
  text,
  text,
  double precision,
  double precision
) TO anon, authenticated, service_role;

ALTER TABLE public.organizations
DROP COLUMN timezone;
