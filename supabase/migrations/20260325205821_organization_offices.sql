CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE public.organization_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_label text,
  location_point extensions.geography(Point, 4326),
  is_remote boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_offices_name_trimmed_chk CHECK (name = trim(name)),
  CONSTRAINT organization_offices_name_length_chk CHECK (char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT organization_offices_remote_location_chk CHECK (
    (is_remote AND location_point IS NULL)
    OR ((NOT is_remote) AND location_point IS NOT NULL)
  )
);

CREATE INDEX organization_offices_organization_id_idx ON public.organization_offices (organization_id);
CREATE INDEX organization_offices_location_point_gist ON public.organization_offices USING GIST (location_point);
CREATE UNIQUE INDEX organization_offices_org_lower_name_uidx ON public.organization_offices (organization_id, lower(name));
CREATE UNIQUE INDEX organization_offices_one_remote_per_org_uidx ON public.organization_offices (organization_id) WHERE is_remote;

ALTER TABLE public.organization_offices ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_offices TO authenticated;

CREATE POLICY organization_offices_select_for_active_members ON public.organization_offices FOR SELECT TO authenticated USING (public.is_active_member_of_organization(organization_id));
CREATE POLICY organization_offices_insert_for_owner_admin ON public.organization_offices FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = organization_offices.organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status
      AND m.role IN ('owner'::public.membership_role, 'admin'::public.membership_role)
  )
);
CREATE POLICY organization_offices_update_for_owner_admin ON public.organization_offices FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = organization_offices.organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status
      AND m.role IN ('owner'::public.membership_role, 'admin'::public.membership_role)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = organization_offices.organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status
      AND m.role IN ('owner'::public.membership_role, 'admin'::public.membership_role)
  )
);
CREATE POLICY organization_offices_delete_for_owner_admin ON public.organization_offices FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.organization_id = organization_offices.organization_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.membership_status
      AND m.role IN ('owner'::public.membership_role, 'admin'::public.membership_role)
  )
);
