-- Migration: move_shift_to_employee_profiles
-- Moves shift/break configuration from memberships to employee_profiles and updates dependent RPCs.

ALTER TABLE public.employee_profiles
  ADD COLUMN shift_duration_hours numeric(4,2) NOT NULL DEFAULT 8.0,
  ADD COLUMN break_duration_hours numeric(4,2) NOT NULL DEFAULT 0.75;

ALTER TABLE public.employee_profiles
  ADD CONSTRAINT ep_shift_duration_positive
    CHECK (shift_duration_hours > 0 AND shift_duration_hours <= 24),
  ADD CONSTRAINT ep_break_duration_non_negative
    CHECK (
      break_duration_hours >= 0
      AND break_duration_hours < shift_duration_hours
    );

INSERT INTO public.employee_profiles (
  membership_id,
  shift_duration_hours,
  break_duration_hours
)
SELECT
  m.id,
  m.shift_duration_hours,
  m.break_duration_hours
FROM public.memberships AS m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.employee_profiles AS ep
  WHERE ep.membership_id = m.id
);

UPDATE public.employee_profiles AS ep
SET
  shift_duration_hours = m.shift_duration_hours,
  break_duration_hours = m.break_duration_hours,
  updated_at = now()
FROM public.memberships AS m
WHERE ep.membership_id = m.id;

CREATE OR REPLACE FUNCTION public.get_open_shift(p_membership_id uuid)
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
    'shift_duration_hours', ep.shift_duration_hours,
    'break_duration_hours', ep.break_duration_hours
  )
  INTO v_open_shift
  FROM public.attendance_records AS ar
  JOIN public.employee_profiles AS ep ON ep.membership_id = ar.membership_id
  LEFT JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.membership_id = p_membership_id
    AND ar.clock_out_at IS NULL
  ORDER BY ar.clock_in_at DESC, ar.created_at DESC, ar.id DESC
  LIMIT 1;

  RETURN v_open_shift;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_close_stale_shifts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.attendance_records AS ar
  SET
    clock_out_at = ar.clock_in_at
      + ((ep.shift_duration_hours + ep.break_duration_hours) * interval '1 hour'),
    auto_closed = true,
    updated_at = now()
  FROM public.employee_profiles AS ep
  WHERE ep.membership_id = ar.membership_id
    AND ar.clock_out_at IS NULL
    AND ar.clock_in_at + interval '16 hours' < now();
END;
$$;

DROP FUNCTION IF EXISTS public.update_membership_shift(uuid, numeric, numeric);

CREATE FUNCTION public.update_employee_profile(
  p_membership_id uuid,
  p_shift_duration_hours numeric DEFAULT NULL,
  p_break_duration_hours numeric DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_hire_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_organization_id uuid;
  v_current_shift_duration numeric;
  v_current_break_duration numeric;
  v_next_shift_duration numeric;
  v_next_break_duration numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

  INSERT INTO public.employee_profiles (membership_id)
  VALUES (p_membership_id)
  ON CONFLICT (membership_id) DO NOTHING;

  SELECT ep.shift_duration_hours, ep.break_duration_hours
  INTO v_current_shift_duration, v_current_break_duration
  FROM public.employee_profiles AS ep
  WHERE ep.membership_id = p_membership_id;

  v_next_shift_duration := coalesce(p_shift_duration_hours, v_current_shift_duration);
  v_next_break_duration := coalesce(p_break_duration_hours, v_current_break_duration);

  IF v_next_shift_duration IS NULL
     OR v_next_shift_duration <= 0
     OR v_next_shift_duration > 24 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_SHIFT_DURATION'
    );
  END IF;

  IF v_next_break_duration IS NULL
     OR v_next_break_duration < 0
     OR v_next_break_duration >= v_next_shift_duration THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_BREAK_DURATION'
    );
  END IF;

  UPDATE public.employee_profiles
  SET
    shift_duration_hours = v_next_shift_duration,
    break_duration_hours = v_next_break_duration,
    position = coalesce(p_position, position),
    department = coalesce(p_department, department),
    hire_date = coalesce(p_hire_date, hire_date),
    updated_at = now()
  WHERE membership_id = p_membership_id;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'shift_duration_hours', v_next_shift_duration,
    'break_duration_hours', v_next_break_duration,
    'position', p_position,
    'department', p_department,
    'hire_date', p_hire_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_employee_profile(uuid, numeric, numeric, text, text, date) TO authenticated;

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
    coalesce(ep.break_duration_hours, 0.75) AS break_duration_hours,
    ar.office_id,
    oo.name AS office_name,
    oo.is_remote AS office_is_remote,
    ar.created_at,
    ar.updated_at
  FROM public.attendance_records AS ar
  LEFT JOIN public.employee_profiles AS ep ON ep.membership_id = ar.membership_id
  LEFT JOIN public.organization_offices AS oo ON oo.id = ar.office_id
  WHERE ar.organization_id = p_organization_id
    AND ar.membership_id = p_membership_id
    AND (p_start_date IS NULL OR ar.work_date >= p_start_date)
    AND (p_end_date IS NULL OR ar.work_date <= p_end_date)
  ORDER BY ar.work_date DESC, ar.clock_in_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_records(uuid, uuid, date, date) TO authenticated;

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS shift_duration_positive,
  DROP CONSTRAINT IF EXISTS break_duration_non_negative,
  DROP COLUMN shift_duration_hours,
  DROP COLUMN break_duration_hours;
