-- Migration: add_text_field_length_constraints
-- Adds CHECK constraints to text columns for defense-in-depth character limits
-- and hardens the update_employee_profile RPC with position/department validation.

-- ============================================================
-- 1. CHECK CONSTRAINTS
-- ============================================================

-- organizations.name (NOT NULL)
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_name_length_chk
    CHECK (char_length(name) >= 2 AND char_length(name) <= 120);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- organization_offices.address_label (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.organization_offices
    ADD CONSTRAINT organization_offices_address_label_length_chk
    CHECK (address_label IS NULL OR (char_length(address_label) >= 3 AND char_length(address_label) <= 180));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_profiles.full_name (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_full_name_length_chk
    CHECK (full_name IS NULL OR (char_length(full_name) >= 1 AND char_length(full_name) <= 80));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_profiles.address (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_address_length_chk
    CHECK (address IS NULL OR (char_length(address) >= 1 AND char_length(address) <= 160));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_profiles.phone (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_phone_length_chk
    CHECK (phone IS NULL OR (char_length(phone) >= 1 AND char_length(phone) <= 30));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- employee_profiles.position (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.employee_profiles
    ADD CONSTRAINT employee_profiles_position_length_chk
    CHECK (position IS NULL OR (char_length(position) >= 1 AND char_length(position) <= 120));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- employee_profiles.department (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.employee_profiles
    ADD CONSTRAINT employee_profiles_department_length_chk
    CHECK (department IS NULL OR (char_length(department) >= 1 AND char_length(department) <= 120));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- memberships.invited_email (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.memberships
    ADD CONSTRAINT memberships_invited_email_length_chk
    CHECK (invited_email IS NULL OR (char_length(invited_email) >= 1 AND char_length(invited_email) <= 254));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- memberships.invitation_code (NULLABLE)
DO $$ BEGIN
  ALTER TABLE public.memberships
    ADD CONSTRAINT memberships_invitation_code_length_chk
    CHECK (invitation_code IS NULL OR (char_length(invitation_code) >= 1 AND char_length(invitation_code) <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. HARDEN update_employee_profile RPC (with weekly_hours)
--    Adds position/department trimming, length, and XSS checks.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_employee_profile(
  p_membership_id uuid,
  p_shift_duration_hours numeric DEFAULT NULL,
  p_break_duration_hours numeric DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_hire_date date DEFAULT NULL,
  p_weekly_hours numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_organization_id uuid;
  v_current_shift numeric;
  v_current_break numeric;
  v_current_weekly_hours numeric;
  v_next_shift numeric;
  v_next_break numeric;
  v_next_weekly_hours numeric;
  v_position text;
  v_department text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT m.organization_id INTO v_organization_id
  FROM public.memberships AS m WHERE m.id = p_membership_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MEMBERSHIP_NOT_FOUND');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = v_organization_id AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status
      AND m.role::text IN ('owner', 'admin', 'manager')
  ) THEN RAISE EXCEPTION 'Unauthorized: insufficient membership permissions'; END IF;

  -- Normalize position: trim + collapse whitespace
  IF p_position IS NOT NULL THEN
    v_position := regexp_replace(trim(p_position), '\s+', ' ', 'g');
    IF char_length(v_position) > 0 THEN
      IF char_length(v_position) < 1 OR char_length(v_position) > 120 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_POSITION');
      END IF;
      IF v_position ~ '[<>]' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_POSITION');
      END IF;
    ELSE
      -- normalized to empty string — treat as NULL (no update)
      v_position := NULL;
    END IF;
  END IF;

  -- Normalize department: trim + collapse whitespace
  IF p_department IS NOT NULL THEN
    v_department := regexp_replace(trim(p_department), '\s+', ' ', 'g');
    IF char_length(v_department) > 0 THEN
      IF char_length(v_department) < 1 OR char_length(v_department) > 120 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DEPARTMENT');
      END IF;
      IF v_department ~ '[<>]' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DEPARTMENT');
      END IF;
    ELSE
      -- normalized to empty string — treat as NULL (no update)
      v_department := NULL;
    END IF;
  END IF;

  INSERT INTO public.employee_profiles (membership_id)
  VALUES (p_membership_id)
  ON CONFLICT (membership_id) DO NOTHING;

  SELECT ep.shift_duration_hours, ep.break_duration_hours, ep.weekly_hours
  INTO v_current_shift, v_current_break, v_current_weekly_hours
  FROM public.employee_profiles AS ep WHERE ep.membership_id = p_membership_id;

  v_next_shift := coalesce(p_shift_duration_hours, v_current_shift);
  v_next_break := coalesce(p_break_duration_hours, v_current_break);
  v_next_weekly_hours := coalesce(p_weekly_hours, v_current_weekly_hours);

  IF v_next_shift IS NULL OR v_next_shift <= 0 OR v_next_shift > 24 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SHIFT_DURATION');
  END IF;

  IF v_next_break IS NULL OR v_next_break < 0 OR v_next_break >= v_next_shift THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_BREAK_DURATION');
  END IF;

  IF v_next_weekly_hours IS NULL OR v_next_weekly_hours <= 0 OR v_next_weekly_hours > 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_WEEKLY_HOURS');
  END IF;

  UPDATE public.employee_profiles
  SET shift_duration_hours = v_next_shift,
      break_duration_hours = v_next_break,
      weekly_hours = v_next_weekly_hours,
      position = coalesce(v_position, position),
      department = coalesce(v_department, department),
      hire_date = coalesce(p_hire_date, hire_date),
      updated_at = now()
  WHERE membership_id = p_membership_id;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'shift_duration_hours', v_next_shift,
    'break_duration_hours', v_next_break,
    'weekly_hours', v_next_weekly_hours,
    'position', v_position,
    'department', v_department,
    'hire_date', p_hire_date
  );
END;
$$;
