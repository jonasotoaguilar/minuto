CREATE TABLE organization_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_text text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT positive_radius CHECK (radius_meters > 0 AND radius_meters <= 5000)
);
CREATE INDEX idx_organization_sites_org_id ON organization_sites(organization_id);
CREATE INDEX idx_organization_sites_active ON organization_sites(organization_id, is_active) WHERE is_active = true;
COMMENT ON TABLE organization_sites IS 'Physical locations where attendance events are valid when geofencing is enabled';
COMMENT ON COLUMN organization_sites.radius_meters IS 'Validation radius in meters (default: 100m, max: 5000m)';
COMMENT ON COLUMN organization_sites.is_active IS 'Inactive sites are not used for validation but preserved for history';
