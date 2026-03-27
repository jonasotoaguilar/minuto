-- Synced from remote Supabase migration history.
-- See local post-geofencing cleanup migrations for the current final state.
CREATE OR REPLACE FUNCTION register_attendance_event(
  p_organization_id uuid,
  p_membership_id uuid,
  p_event_type text,
  p_work_date date,
  p_occurred_at timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object('synced_from_remote', true);
END;
$$;
