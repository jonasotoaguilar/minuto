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
DECLARE
  v_geofencing_enabled boolean;
  v_nearest_site record;
  v_distance_meters integer;
  v_attendance_id uuid;
  v_existing_record record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = p_organization_id
      AND id = p_membership_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: membership not found or does not belong to caller';
  END IF;

  SELECT geofencing_enabled INTO v_geofencing_enabled
  FROM organizations
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF v_geofencing_enabled THEN
    SELECT s.id, s.name, s.radius_meters,
      calculate_distance_meters(p_latitude, p_longitude, s.latitude, s.longitude) as distance
    INTO v_nearest_site
    FROM organization_sites s
    WHERE s.organization_id = p_organization_id
      AND s.is_active = true
    ORDER BY calculate_distance_meters(p_latitude, p_longitude, s.latitude, s.longitude) ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_active_sites', 'message', 'No hay sedes activas configuradas para esta organización');
    END IF;

    v_distance_meters := v_nearest_site.distance;
    IF v_distance_meters > v_nearest_site.radius_meters THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'outside_geofence',
        'message', 'Estás fuera del área permitida',
        'nearest_site_name', v_nearest_site.name,
        'distance_meters', v_distance_meters,
        'required_radius', v_nearest_site.radius_meters
      );
    END IF;
  ELSE
    v_nearest_site := NULL;
    v_distance_meters := NULL;
  END IF;

  IF p_event_type = 'clock_in' THEN
    SELECT id, clock_in_at INTO v_existing_record
    FROM attendance_records
    WHERE organization_id = p_organization_id
      AND membership_id = p_membership_id
      AND work_date = p_work_date;

    IF FOUND AND v_existing_record.clock_in_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_clocked_in', 'message', 'La entrada de hoy ya está registrada');
    END IF;

    INSERT INTO attendance_records (
      organization_id, membership_id, work_date, clock_in_at, clock_in_location, clock_in_site_id, clock_in_distance_meters
    ) VALUES (
      p_organization_id, p_membership_id, p_work_date, p_occurred_at,
      jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude, 'accuracy', p_accuracy),
      v_nearest_site.id, v_distance_meters
    )
    ON CONFLICT (organization_id, membership_id, work_date)
    DO UPDATE SET
      clock_in_at = EXCLUDED.clock_in_at,
      clock_in_location = EXCLUDED.clock_in_location,
      clock_in_site_id = EXCLUDED.clock_in_site_id,
      clock_in_distance_meters = EXCLUDED.clock_in_distance_meters
    RETURNING id INTO v_attendance_id;

    RETURN jsonb_build_object('success', true, 'attendance_id', v_attendance_id, 'event_type', 'clock_in', 'validated_site_id', v_nearest_site.id, 'distance_meters', v_distance_meters);
  ELSIF p_event_type = 'clock_out' THEN
    SELECT id, clock_out_at INTO v_existing_record
    FROM attendance_records
    WHERE organization_id = p_organization_id
      AND membership_id = p_membership_id
      AND work_date = p_work_date;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_clock_in', 'message', 'No hay entrada registrada para marcar salida');
    END IF;

    IF v_existing_record.clock_out_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_clocked_out', 'message', 'La salida ya está registrada');
    END IF;

    UPDATE attendance_records
    SET clock_out_at = p_occurred_at,
        clock_out_location = jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude, 'accuracy', p_accuracy),
        clock_out_site_id = v_nearest_site.id,
        clock_out_distance_meters = v_distance_meters
    WHERE id = v_existing_record.id
    RETURNING id INTO v_attendance_id;

    RETURN jsonb_build_object('success', true, 'attendance_id', v_attendance_id, 'event_type', 'clock_out', 'validated_site_id', v_nearest_site.id, 'distance_meters', v_distance_meters);
  ELSE
    RAISE EXCEPTION 'Invalid event_type: must be clock_in or clock_out';
  END IF;
END;
$$;
COMMENT ON FUNCTION register_attendance_event IS 'Registers clock-in or clock-out with geofencing validation. Returns success/error and validation details';
