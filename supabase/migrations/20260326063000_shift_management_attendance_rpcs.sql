-- Migration: shift_management_attendance_rpcs
-- Updates attendance RPCs for open-shift detection and custom close handling.

CREATE OR REPLACE FUNCTION public.attendance_clock_in(
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
  v_open_shift jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: membership does not belong to caller';
  END IF;

  SELECT m.organization_id
  INTO v_user_org_id
  FROM public.memberships AS m
  WHERE m.id = p_membership_id;

  IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Unauthorized: organization mismatch';
  END IF;

  v_open_shift := public.get_open_shift(p_membership_id);

  IF v_open_shift IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'OPEN_SHIFT_EXISTS',
      'record_id', v_open_shift -> 'record_id',
      'work_date', v_open_shift -> 'work_date',
      'clock_in_at', v_open_shift -> 'clock_in_at',
      'open_shift', v_open_shift
    );
  END IF;

  IF p_is_remote THEN
    SELECT id, name
    INTO v_office_id, v_office_name
    FROM public.organization_offices
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
    FROM public.organization_offices
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
    FROM public.organization_offices
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

  BEGIN
    INSERT INTO public.attendance_records (
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
  EXCEPTION
    WHEN unique_violation THEN
      v_open_shift := public.get_open_shift(p_membership_id);

      IF v_open_shift IS NULL THEN
        RAISE;
      END IF;

      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OPEN_SHIFT_EXISTS',
        'record_id', v_open_shift -> 'record_id',
        'work_date', v_open_shift -> 'work_date',
        'clock_in_at', v_open_shift -> 'clock_in_at',
        'open_shift', v_open_shift
      );
  END;

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

DROP FUNCTION IF EXISTS public.attendance_clock_out(
  uuid,
  double precision,
  double precision,
  double precision,
  boolean
);

CREATE FUNCTION public.attendance_clock_out(
  p_record_id uuid,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL,
  p_is_remote boolean DEFAULT false,
  p_custom_close_at timestamptz DEFAULT NULL,
  p_auto_closed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_office_name text;
  v_clock_in_at timestamptz;
  v_close_at timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.attendance_records AS ar
    JOIN public.memberships AS m ON m.id = ar.membership_id
    WHERE ar.id = p_record_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: record does not belong to caller';
  END IF;

  SELECT ar.clock_in_at
  INTO v_clock_in_at
  FROM public.attendance_records AS ar
  WHERE ar.id = p_record_id
    AND ar.clock_out_at IS NULL;

  IF v_clock_in_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NO_OPEN_RECORD'
    );
  END IF;

  v_close_at := coalesce(p_custom_close_at, now());

  IF v_close_at < v_clock_in_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_CLOSE_TIME',
      'clock_in_at', v_clock_in_at
    );
  END IF;

  SELECT oo.name
  INTO v_office_name
  FROM public.attendance_records AS ar
  JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.id = p_record_id;

  UPDATE public.attendance_records
  SET
    clock_out_at = v_close_at,
    auto_closed = p_auto_closed,
    updated_at = now()
  WHERE id = p_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'office_name', v_office_name,
    'clock_out_at', v_close_at,
    'auto_closed', p_auto_closed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.attendance_clock_out(
  uuid,
  double precision,
  double precision,
  double precision,
  boolean,
  timestamptz,
  boolean
) TO authenticated;
