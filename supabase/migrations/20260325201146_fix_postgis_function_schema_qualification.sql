-- Migration: fix_postgis_function_schema_qualification
-- PostGIS was installed in the `extensions` schema, but the attendance RPCs run
-- with `SET search_path TO public`. Unqualified references like ::geometry,
-- ::geography, ST_X, ST_Y, ST_SetSRID, and ST_MakePoint therefore failed at
-- runtime inside those SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION public.attendance_clock_in(
  p_organization_id uuid,
  p_membership_id   uuid,
  p_work_date       date,
  p_latitude        double precision,
  p_longitude       double precision,
  p_accuracy        double precision DEFAULT NULL,
  p_address         text             DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: membership does not belong to caller';
  END IF;

  INSERT INTO attendance_records (
    organization_id,
    membership_id,
    work_date,
    clock_in_at,
    clock_in_point,
    clock_in_address
  ) VALUES (
    p_organization_id,
    p_membership_id,
    p_work_date,
    now(),
    extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_longitude, p_latitude),
      4326
    )::extensions.geography,
    p_address
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_clock_out(
  p_record_id uuid,
  p_latitude  double precision,
  p_longitude double precision,
  p_accuracy  double precision DEFAULT NULL,
  p_address   text             DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM attendance_records AS ar
    JOIN memberships AS m ON m.id = ar.membership_id
    WHERE ar.id = p_record_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: record does not belong to caller';
  END IF;

  UPDATE attendance_records
  SET
    clock_out_at = now(),
    clock_out_point = extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_longitude, p_latitude),
      4326
    )::extensions.geography,
    clock_out_address = p_address,
    updated_at = now()
  WHERE id = p_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_attendance_records(
  p_organization_id uuid,
  p_membership_id   uuid,
  p_start_date      date DEFAULT NULL,
  p_end_date        date DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  organization_id     uuid,
  membership_id       uuid,
  work_date           date,
  clock_in_at         timestamptz,
  clock_out_at        timestamptz,
  clock_in_latitude   double precision,
  clock_in_longitude  double precision,
  clock_out_latitude  double precision,
  clock_out_longitude double precision,
  clock_in_address    text,
  clock_out_address   text,
  created_at          timestamptz,
  updated_at          timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    ar.id,
    ar.organization_id,
    ar.membership_id,
    ar.work_date,
    ar.clock_in_at,
    ar.clock_out_at,
    extensions.ST_Y(ar.clock_in_point::extensions.geometry) AS clock_in_latitude,
    extensions.ST_X(ar.clock_in_point::extensions.geometry) AS clock_in_longitude,
    extensions.ST_Y(ar.clock_out_point::extensions.geometry) AS clock_out_latitude,
    extensions.ST_X(ar.clock_out_point::extensions.geometry) AS clock_out_longitude,
    ar.clock_in_address,
    ar.clock_out_address,
    ar.created_at,
    ar.updated_at
  FROM attendance_records AS ar
  WHERE ar.organization_id = p_organization_id
    AND ar.membership_id = p_membership_id
    AND (p_start_date IS NULL OR ar.work_date >= p_start_date)
    AND (p_end_date IS NULL OR ar.work_date <= p_end_date)
  ORDER BY ar.work_date DESC, ar.clock_in_at DESC;
END;
$$;
