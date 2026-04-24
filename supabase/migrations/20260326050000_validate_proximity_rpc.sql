CREATE OR REPLACE FUNCTION public.validate_proximity(
  p_organization_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_office_id uuid;
  v_office_name text;
  v_user_point geography;
BEGIN
  -- Check GPS accuracy
  IF p_accuracy > 50 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'GPS_ACCURACY_TOO_LOW'
    );
  END IF;

  -- Build user point
  v_user_point := ST_SetSRID(
    ST_MakePoint(p_longitude, p_latitude),
    4326
  )::geography;

  -- Find nearest office within 100m
  SELECT id, name
  INTO v_office_id, v_office_name
  FROM organization_offices
  WHERE organization_id = p_organization_id
    AND is_remote = false
    AND ST_DWithin(location_point, v_user_point, 100)
  ORDER BY ST_Distance(location_point, v_user_point) ASC
  LIMIT 1;

  IF v_office_id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'OUT_OF_RANGE'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'office_id', v_office_id,
    'office_name', v_office_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_proximity(uuid, double precision, double precision, double precision) TO authenticated;
