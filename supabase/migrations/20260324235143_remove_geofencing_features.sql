DROP FUNCTION IF EXISTS public.register_attendance_event(uuid, uuid, text, date, timestamptz, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.set_organization_geofencing(uuid, boolean);
DROP FUNCTION IF EXISTS public.calculate_distance_meters(double precision, double precision, double precision, double precision);

ALTER TABLE public.attendance_records
  DROP COLUMN IF EXISTS clock_in_site_id,
  DROP COLUMN IF EXISTS clock_in_distance_meters,
  DROP COLUMN IF EXISTS clock_out_site_id,
  DROP COLUMN IF EXISTS clock_out_distance_meters;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS geofencing_enabled;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_sites') THEN
    DROP POLICY IF EXISTS "organization_sites_select_active_members" ON public.organization_sites;
    DROP POLICY IF EXISTS "organization_sites_insert_owner_admin" ON public.organization_sites;
    DROP POLICY IF EXISTS "organization_sites_update_owner_admin" ON public.organization_sites;
    DROP POLICY IF EXISTS "organization_sites_delete_owner_admin" ON public.organization_sites;
    DROP TABLE public.organization_sites;
  END IF;
END $$;
