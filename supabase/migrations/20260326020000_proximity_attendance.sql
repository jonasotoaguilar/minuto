-- Migration: proximity_attendance
-- Adds office_id FK to attendance_records, updates RPCs for proximity validation

-- 1. Add office_id column (nullable for now, will be made NOT NULL after backfill in 1.2)
ALTER TABLE public.attendance_records
  ADD COLUMN office_id uuid REFERENCES public.organization_offices(id);

-- 2. Add index on office_id for FK lookups
CREATE INDEX attendance_records_office_id_idx
  ON public.attendance_records (office_id);

-- 3. GiST index on organization_offices.location_point already exists from 20260325231500_organization_offices.sql
-- Verified: CREATE INDEX organization_offices_location_point_gist

-- 4. Update attendance_clock_in with proximity validation
DROP FUNCTION IF EXISTS public.attendance_clock_in(
  uuid,
  uuid,
  date,
  double precision,
  double precision,
  double precision
);

CREATE FUNCTION public.attendance_clock_in(
  p_organization_id uuid,
  p_membership_id   uuid,
  p_work_date       date,
  p_latitude        double precision,
  p_longitude       double precision,
  p_accuracy        double precision DEFAULT NULL,
  p_is_remote       boolean DEFAULT false
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
  v_user_point extensions.geography;
  v_user_org_id uuid;
BEGIN
  -- Verify membership belongs to caller
  IF NOT EXISTS (
    SELECT 1
    FROM memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: membership does not belong to caller';
  END IF;

  -- Get user's organization from membership
  SELECT m.organization_id INTO v_user_org_id
  FROM memberships AS m
  WHERE m.id = p_membership_id;

  -- Check for existing open record (prevent double clock-in)
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

  -- Handle remote work
  IF p_is_remote THEN
    -- Find Remote office for user's organization
    SELECT id, name INTO v_office_id, v_office_name
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

  ELSE
    -- Check GPS accuracy
    IF p_accuracy > 50 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'GPS_ACCURACY_TOO_LOW'
      );
    END IF;

    -- Build user point
    v_user_point := extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_longitude, p_latitude),
      4326
    )::extensions.geography;

    -- Find nearest office within 100m
    SELECT id, name
    INTO v_office_id, v_office_name
    FROM organization_offices
    WHERE organization_id = v_user_org_id
      AND is_remote = false
      AND extensions.ST_DWithin(location_point, v_user_point, 100)
    ORDER BY extensions.ST_Distance(location_point, v_user_point) ASC
    LIMIT 1;

    IF v_office_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'OUT_OF_RANGE'
      );
    END IF;
  END IF;

  -- Insert attendance record with office_id
  INSERT INTO attendance_records (
    organization_id,
    membership_id,
    work_date,
    clock_in_at,
    clock_in_point,
    office_id
  ) VALUES (
    p_organization_id,
    p_membership_id,
    p_work_date,
    now(),
    CASE 
      WHEN p_is_remote THEN NULL
      ELSE extensions.ST_SetSRID(
        extensions.ST_MakePoint(p_longitude, p_latitude),
        4326
      )::extensions.geography
    END,
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

-- 5. Update attendance_clock_out (no proximity re-validation)
DROP FUNCTION IF EXISTS public.attendance_clock_out(
  uuid,
  double precision,
  double precision,
  double precision
);

CREATE FUNCTION public.attendance_clock_out(
  p_record_id uuid,
  p_latitude  double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy  double precision DEFAULT NULL,
  p_is_remote boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_office_name text;
BEGIN
  -- Verify record belongs to caller
  IF NOT EXISTS (
    SELECT 1
    FROM attendance_records AS ar
    JOIN memberships AS m ON m.id = ar.membership_id
    WHERE ar.id = p_record_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: record does not belong to caller';
  END IF;

  -- Check for open record
  IF NOT EXISTS (
    SELECT 1
    FROM attendance_records AS ar
    WHERE ar.id = p_record_id
      AND ar.clock_out_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NO_OPEN_RECORD'
    );
  END IF;

  -- Get office name for response
  SELECT oo.name INTO v_office_name
  FROM attendance_records AS ar
  JOIN organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.id = p_record_id;

  -- Update record with clock_out_at (NO proximity validation)
  UPDATE attendance_records
  SET
    clock_out_at = now(),
    clock_out_point = CASE
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND NOT p_is_remote THEN
        extensions.ST_SetSRID(
          extensions.ST_MakePoint(p_longitude, p_latitude),
          4326
        )::extensions.geography
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'office_name', v_office_name
  );
END;
$$;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.attendance_clock_in(
  uuid,
  uuid,
  date,
  double precision,
  double precision,
  double precision,
  boolean
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.attendance_clock_out(
  uuid,
  double precision,
  double precision,
  double precision,
  boolean
) TO authenticated;
