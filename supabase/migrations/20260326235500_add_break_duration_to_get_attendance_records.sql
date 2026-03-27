-- Migration: add_break_duration_to_get_attendance_records
-- Includes membership break duration in attendance history RPC payloads.

DROP FUNCTION IF EXISTS public.get_attendance_records(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_attendance_records(
  p_organization_id uuid,
  p_membership_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  membership_id uuid,
  work_date date,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_duration_hours numeric,
  office_id uuid,
  office_name text,
  office_is_remote boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
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
    coalesce(m.break_duration_hours, 0.75) AS break_duration_hours,
    ar.office_id,
    oo.name AS office_name,
    oo.is_remote AS office_is_remote,
    ar.created_at,
    ar.updated_at
  FROM public.attendance_records AS ar
  JOIN public.memberships AS m ON m.id = ar.membership_id
  LEFT JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.organization_id = p_organization_id
    AND ar.membership_id = p_membership_id
    AND (p_start_date IS NULL OR ar.work_date >= p_start_date)
    AND (p_end_date IS NULL OR ar.work_date <= p_end_date)
  ORDER BY ar.work_date DESC, ar.clock_in_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_records(uuid, uuid, date, date) TO authenticated;
