CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
) RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius_m constant double precision := 6371000;
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat / 2) * sin(dlat / 2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) * sin(dlon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  RETURN ROUND(earth_radius_m * c)::integer;
END;
$$;
COMMENT ON FUNCTION calculate_distance_meters IS 'Calculates distance in meters between two geographic points using Haversine formula';
