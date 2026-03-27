ALTER TABLE attendance_records
  ADD COLUMN clock_in_site_id uuid REFERENCES organization_sites(id) ON DELETE SET NULL,
  ADD COLUMN clock_in_distance_meters integer,
  ADD COLUMN clock_out_site_id uuid REFERENCES organization_sites(id) ON DELETE SET NULL,
  ADD COLUMN clock_out_distance_meters integer;
CREATE INDEX idx_attendance_records_clock_in_site ON attendance_records(clock_in_site_id) WHERE clock_in_site_id IS NOT NULL;
CREATE INDEX idx_attendance_records_clock_out_site ON attendance_records(clock_out_site_id) WHERE clock_out_site_id IS NOT NULL;
COMMENT ON COLUMN attendance_records.clock_in_site_id IS 'Site that validated the clock-in event (null if geofencing disabled or no validation)';
COMMENT ON COLUMN attendance_records.clock_in_distance_meters IS 'Calculated distance in meters from user to validated site at clock-in';
COMMENT ON COLUMN attendance_records.clock_out_site_id IS 'Site that validated the clock-out event (null if geofencing disabled or no validation)';
COMMENT ON COLUMN attendance_records.clock_out_distance_meters IS 'Calculated distance in meters from user to validated site at clock-out';
