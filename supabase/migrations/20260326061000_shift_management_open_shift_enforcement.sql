-- Migration: shift_management_open_shift_enforcement
-- Closes duplicate open shifts, adds one-open-shift index, and exposes get_open_shift.

WITH ranked_open_shifts AS (
  SELECT
    ar.id,
    ar.clock_in_at,
    coalesce(m.shift_duration_hours, 8.0) AS shift_duration_hours,
    coalesce(m.break_duration_hours, 0.75) AS break_duration_hours,
    row_number() OVER (
      PARTITION BY ar.membership_id
      ORDER BY ar.clock_in_at DESC, ar.created_at DESC, ar.id DESC
    ) AS row_number
  FROM public.attendance_records AS ar
  JOIN public.memberships AS m ON m.id = ar.membership_id
  WHERE ar.clock_out_at IS NULL
)
UPDATE public.attendance_records AS ar
SET
  clock_out_at = ar.clock_in_at
    + ((ros.shift_duration_hours + ros.break_duration_hours) * interval '1 hour'),
  auto_closed = true,
  updated_at = now()
FROM ranked_open_shifts AS ros
WHERE ar.id = ros.id
  AND ros.row_number > 1;

CREATE UNIQUE INDEX attendance_one_open_shift_per_member
  ON public.attendance_records (membership_id)
  WHERE clock_out_at IS NULL;

DROP FUNCTION IF EXISTS public.get_open_shift(uuid);

CREATE FUNCTION public.get_open_shift(p_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_open_shift jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.id = p_membership_id
      AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: membership does not belong to caller';
  END IF;

  SELECT jsonb_build_object(
    'record_id', ar.id,
    'work_date', ar.work_date,
    'clock_in_at', ar.clock_in_at,
    'office_id', ar.office_id,
    'office_name', oo.name,
    'office_is_remote', oo.is_remote,
    'shift_duration_hours', m.shift_duration_hours,
    'break_duration_hours', m.break_duration_hours
  )
  INTO v_open_shift
  FROM public.attendance_records AS ar
  JOIN public.memberships AS m ON m.id = ar.membership_id
  LEFT JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.membership_id = p_membership_id
    AND ar.clock_out_at IS NULL
  ORDER BY ar.clock_in_at DESC, ar.created_at DESC, ar.id DESC
  LIMIT 1;

  RETURN v_open_shift;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_shift(uuid) TO authenticated;
