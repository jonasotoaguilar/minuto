-- Migration: shift_management_auto_close
-- Adds stale-shift auto-close routine and schedules hourly pg_cron job.

DROP FUNCTION IF EXISTS public.auto_close_stale_shifts();

CREATE FUNCTION public.auto_close_stale_shifts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.attendance_records AS ar
  SET
    clock_out_at = ar.clock_in_at
      + ((m.shift_duration_hours + m.break_duration_hours) * interval '1 hour'),
    auto_closed = true,
    updated_at = now()
  FROM public.memberships AS m
  WHERE m.id = ar.membership_id
    AND ar.clock_out_at IS NULL
    AND ar.clock_in_at + interval '16 hours' < now();
END;
$$;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'cron'
  ) THEN
    FOR v_job_id IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'auto-close-stale-shifts'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'cron'
  ) THEN
    PERFORM cron.schedule(
      'auto-close-stale-shifts',
      '0 * * * *',
      $cron$SELECT public.auto_close_stale_shifts()$cron$
    );
  END IF;
END;
$$;
