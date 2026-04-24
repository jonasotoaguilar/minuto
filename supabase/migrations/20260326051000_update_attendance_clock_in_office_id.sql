DROP FUNCTION IF EXISTS public.attendance_clock_in(
  uuid,
  uuid,
  date,
  double precision,
  double precision,
  double precision,
  boolean
);

CREATE FUNCTION public.attendance_clock_in(
  p_organization_id uuid,
  p_membership_id uuid,
  p_work_date date,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL,
  p_office_id uuid DEFAULT NULL,
  p_is_remote boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record_id uuid;
  v_office_id uuid;
  v_office_name text;
  v_user_point geography;
  v_user_org_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: membership does not belong to caller';
  END IF;

  SELECT m.organization_id
  INTO v_user_org_id
  FROM memberships AS m
  WHERE m.id = p_membership_id;

  IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Unauthorized: organization mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM attendance_records AS ar
    WHERE ar.membership_id = p_membership_id
      AND ar.clock_out_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_CLOCKED_IN'
    );
  END IF;

  IF p_is_remote THEN
    SELECT id, name
    INTO v_office_id, v_office_name
    FROM organization_offices
    WHERE organization_id = v_user_org_id
      AND is_remote = true
    LIMIT 1;

    IF v_office_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'NO_REMOTE_OFFICE'
      );
    END IF;
  ELSIF p_office_id IS NOT NULL THEN
    SELECT id, name
    INTO v_office_id, v_office_name
    FROM organization_offices
    WHERE id = p_office_id
      AND organization_id = v_user_org_id
      AND is_remote = false
    LIMIT 1;

    IF v_office_id IS NULL THEN
      RAISE EXCEPTION 'Invalid office for organization';
    END IF;
  ELSE
    IF p_accuracy > 50 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'GPS_ACCURACY_TOO_LOW'
      );
    END IF;

    v_user_point := ST_SetSRID(
      ST_MakePoint(p_longitude, p_latitude),
      4326
    )::geography;

    SELECT id, name
    INTO v_office_id, v_office_name
    FROM organization_offices
    WHERE organization_id = v_user_org_id
      AND is_remote = false
      AND ST_DWithin(location_point, v_user_point, 100)
    ORDER BY ST_Distance(location_point, v_user_point) ASC
    LIMIT 1;

    IF v_office_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_RANGE'
      );
    END IF;
  END IF;

  INSERT INTO attendance_records (
    organization_id,
    membership_id,
    work_date,
    clock_in_at,
    office_id
  ) VALUES (
    p_organization_id,
    p_membership_id,
    p_work_date,
    now(),
    v_office_id
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', v_record_id,
    'office_id', v_office_id,
    'office_name', v_office_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.attendance_clock_in(
  uuid,
  uuid,
  date,
  double precision,
  double precision,
  double precision,
  uuid,
  boolean
) TO authenticated;
