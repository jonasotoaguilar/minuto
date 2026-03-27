ALTER TABLE organizations ADD COLUMN geofencing_enabled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN organizations.geofencing_enabled IS 'When true, attendance events must pass geofencing validation against organization_sites';
