-- Migration: add_get_organization_offices_rpc
-- Exposes office coordinates as numeric latitude/longitude fields for clients
-- without leaking raw PostGIS geography values.
-- Filters out remote offices (internal/system records not shown to users).

CREATE OR REPLACE FUNCTION public.get_organization_offices(
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  address_label text,
  is_remote boolean,
  latitude double precision,
  longitude double precision,
  organization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oo.id,
    oo.name,
    oo.address_label,
    oo.is_remote,
    extensions.ST_Y(oo.location_point::extensions.geometry) as latitude,
    extensions.ST_X(oo.location_point::extensions.geometry) as longitude,
    oo.organization_id
  FROM organization_offices oo
  WHERE oo.organization_id = p_organization_id
    AND oo.is_remote = false
  ORDER BY oo.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_offices(uuid)
TO authenticated;
