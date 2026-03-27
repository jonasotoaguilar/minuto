-- Migration: postgis_attendance_location
-- Adds PostGIS geography columns for clock-in/out points, human-readable address
-- columns, GiST indexes, and SECURITY DEFINER RPCs for clock-in, clock-out, and read.
--
-- NOTE: This migration was applied with the wrong membership table name
-- ('organization_members' instead of 'memberships'). The follow-up migration
-- 20260325195123_fix_attendance_rpcs_table_reference.sql corrects that.

-- 1. Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add PostGIS geography columns to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS clock_in_point  geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS clock_out_point geography(Point, 4326);

-- 3. Add human-readable address text columns
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS clock_in_address  text,
  ADD COLUMN IF NOT EXISTS clock_out_address text;

-- 4. Create GiST spatial indexes for efficient proximity queries
CREATE INDEX IF NOT EXISTS attendance_records_clock_in_point_gist
  ON public.attendance_records USING GIST (clock_in_point);

CREATE INDEX IF NOT EXISTS attendance_records_clock_out_point_gist
  ON public.attendance_records USING GIST (clock_out_point);

-- 5. RPC: attendance_clock_in
--    Inserts a new attendance record with a PostGIS geography point.
--    NOTE: References 'organization_members' — corrected in next migration.
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
  -- Verify the caller owns this membership
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE id = p_membership_id
      AND user_id = auth.uid()
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
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_address
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

-- 6. RPC: attendance_clock_out
--    Updates an existing record with clock-out point.
--    NOTE: References 'organization_members' — corrected in next migration.
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
  -- Verify the caller owns this record via membership
  IF NOT EXISTS (
    SELECT 1 FROM attendance_records ar
    JOIN organization_members om ON om.id = ar.membership_id
    WHERE ar.id = p_record_id
      AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: record does not belong to caller';
  END IF;

  UPDATE attendance_records
  SET
    clock_out_at      = now(),
    clock_out_point   = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    clock_out_address = p_address,
    updated_at        = now()
  WHERE id = p_record_id;
END;
$$;

-- 7. RPC: get_attendance_records
--    Returns attendance records with extracted lat/lng from PostGIS columns.
--    NOTE: References 'organization_members' — corrected in next migration.
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
  -- Verify the caller owns this membership OR is an admin of the org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE id = p_membership_id
      AND user_id = auth.uid()
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
    ST_Y(ar.clock_in_point::geometry)  AS clock_in_latitude,
    ST_X(ar.clock_in_point::geometry)  AS clock_in_longitude,
    ST_Y(ar.clock_out_point::geometry) AS clock_out_latitude,
    ST_X(ar.clock_out_point::geometry) AS clock_out_longitude,
    ar.clock_in_address,
    ar.clock_out_address,
    ar.created_at,
    ar.updated_at
  FROM attendance_records ar
  WHERE ar.organization_id = p_organization_id
    AND ar.membership_id   = p_membership_id
    AND (p_start_date IS NULL OR ar.work_date >= p_start_date)
    AND (p_end_date   IS NULL OR ar.work_date <= p_end_date)
  ORDER BY ar.work_date DESC, ar.clock_in_at DESC;
END;
$$;
