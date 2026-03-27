-- Migration: fix_get_attendance_records_ambiguous_id
-- Fixes an ambiguous identifier bug in public.get_attendance_records.
-- Because the function RETURNS TABLE (... id uuid, ...), PL/pgSQL creates an
-- output variable named "id". The authorization query used an unqualified
-- "WHERE id = p_membership_id", which became ambiguous against memberships.id
-- at runtime.

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
  -- Verify the caller owns this membership.
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
    ST_Y(ar.clock_in_point::geometry)  AS clock_in_latitude,
    ST_X(ar.clock_in_point::geometry)  AS clock_in_longitude,
    ST_Y(ar.clock_out_point::geometry) AS clock_out_latitude,
    ST_X(ar.clock_out_point::geometry) AS clock_out_longitude,
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
