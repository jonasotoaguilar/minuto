-- Migration: shift_management_schema
-- Adds membership shift config and attendance auto-close tracking.

ALTER TABLE public.memberships
  ADD COLUMN shift_duration_hours numeric(4,2) NOT NULL DEFAULT 8.0,
  ADD COLUMN break_duration_hours numeric(4,2) NOT NULL DEFAULT 0.75;

ALTER TABLE public.memberships
  ADD CONSTRAINT shift_duration_positive
    CHECK (shift_duration_hours > 0 AND shift_duration_hours <= 24),
  ADD CONSTRAINT break_duration_non_negative
    CHECK (
      break_duration_hours >= 0
      AND break_duration_hours < shift_duration_hours
    );

ALTER TABLE public.attendance_records
  ADD COLUMN auto_closed boolean NOT NULL DEFAULT false;
