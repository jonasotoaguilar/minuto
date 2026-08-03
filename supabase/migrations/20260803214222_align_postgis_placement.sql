-- Corrective migration: align PostGIS placement expectations for reproducible replay (F03)
--
-- Root cause (audit F03): migrations 20260325193314 and 20260325205821 run a
-- schema-less `CREATE EXTENSION IF NOT EXISTS postgis`, so a clean replay
-- installs PostGIS in `public`. The final RPC bodies (20260423202954_remote_schema)
-- call `extensions.ST_*` (ST_MakePoint, ST_SetSRID, ST_DWithin, ST_Distance,
-- ST_X, ST_Y) plus `::public.geography` / `::public.geometry` casts, so on a
-- fresh replay five RPCs (attendance clock-in, office creation, organization
-- creation, office retrieval, proximity validation) fail at runtime with
-- "function extensions.st_* does not exist".
--
-- The live remote project is healthy because PostGIS lives in `extensions`
-- there (applied out-of-band, absent from migration history). PostGIS is not
-- relocatable: `ALTER EXTENSION postgis SET SCHEMA extensions` is rejected
-- ("extension does not support SET SCHEMA"), and DROP EXTENSION + recreate
-- would cascade-drop `organization_offices.location_point` (data loss on any
-- non-fresh database). Instead, this migration creates thin `extensions.*`
-- delegation wrappers over the `public.*` PostGIS functions ONLY when PostGIS
-- is installed in `public` (fresh-replay state). On databases where PostGIS
-- already lives in `extensions` (remote), this block is a no-op and the real
-- PostGIS functions keep serving the calls.
--
-- The wrappers mirror exactly the signatures used by the five RPC bodies, so
-- no function definitions or API contracts change.
--
-- pg_cron needs no correction: 20260423202954 installs it into pg_catalog
-- deterministically (verified on local replay and on remote).

DO $body$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension AS e
    JOIN pg_namespace AS n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis' AND n.nspname = 'public'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS extensions;

    EXECUTE $fn$CREATE OR REPLACE FUNCTION extensions.st_makepoint(
      x double precision,
      y double precision
    )
    RETURNS public.geometry
    LANGUAGE sql IMMUTABLE STRICT
    AS $$ SELECT public.st_makepoint($1, $2) $$;$fn$;

    EXECUTE $fn$CREATE OR REPLACE FUNCTION extensions.st_setsrid(
      geom public.geometry,
      srid integer
    )
    RETURNS public.geometry
    LANGUAGE sql IMMUTABLE STRICT
    AS $$ SELECT public.st_setsrid($1, $2) $$;$fn$;

    EXECUTE $fn$CREATE OR REPLACE FUNCTION extensions.st_dwithin(
      a public.geography,
      b public.geography,
      distance double precision
    )
    RETURNS boolean
    LANGUAGE sql IMMUTABLE STRICT
    AS $$ SELECT public.st_dwithin($1, $2, $3) $$;$fn$;

    EXECUTE $fn$CREATE OR REPLACE FUNCTION extensions.st_distance(
      a public.geography,
      b public.geography
    )
    RETURNS double precision
    LANGUAGE sql IMMUTABLE STRICT
    AS $$ SELECT public.st_distance($1, $2) $$;$fn$;

    EXECUTE $fn$CREATE OR REPLACE FUNCTION extensions.st_x(
      geom public.geometry
    )
    RETURNS double precision
    LANGUAGE sql IMMUTABLE STRICT
    AS $$ SELECT public.st_x($1) $$;$fn$;

    EXECUTE $fn$CREATE OR REPLACE FUNCTION extensions.st_y(
      geom public.geometry
    )
    RETURNS double precision
    LANGUAGE sql IMMUTABLE STRICT
    AS $$ SELECT public.st_y($1) $$;$fn$;
  END IF;
END
$body$;
