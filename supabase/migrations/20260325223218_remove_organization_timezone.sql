DROP FUNCTION IF EXISTS public.create_organization_with_owner(
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision
);

ALTER TABLE public.organizations
DROP COLUMN timezone;
