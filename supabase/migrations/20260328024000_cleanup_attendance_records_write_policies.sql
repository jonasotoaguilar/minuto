-- Migration: cleanup_attendance_records_write_policies
-- Attendance writes are performed through SECURITY DEFINER RPCs
-- (attendance_clock_in / attendance_clock_out), so direct table writes
-- from clients should stay blocked.

DROP POLICY IF EXISTS "Members can insert own attendance records"
  ON public.attendance_records;

DROP POLICY IF EXISTS "Members can update own attendance records"
  ON public.attendance_records;

COMMENT ON TABLE public.attendance_records IS
  'RLS HARDENED: clients can only read own records; writes must go through attendance RPCs.';
