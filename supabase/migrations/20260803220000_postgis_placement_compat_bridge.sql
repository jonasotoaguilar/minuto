-- Corrective migration: placement-agnostic PostGIS type bridge for replay parity (F03)
--
-- Why this exists (audit F03, L01 issue #21):
--   The PostGIS setup migrations (20260325193314, 20260325205821) run a
--   schema-less `CREATE EXTENSION IF NOT EXISTS postgis`, so a clean replay
--   installs PostGIS in `public`. The live remote project instead has PostGIS
--   in `extensions` (installed out-of-band, absent from migration history).
--   The hardened RPC bodies in the pending migrations
--   (20260803223744_harden_rpc_search_path, 20260804005812_invoker_conversion_and_revoke_ambiguity)
--   hardcode `::public.geometry` / `::public.geography` casts, which only
--   resolve when PostGIS lives in `public`. On the remote, `supabase db push`
--   therefore aborted at `20260803223744` with
--   `type "public.geography" does not exist`.
--
-- What this migration does:
--   * When PostGIS lives in `public` (clean replay), the real
--     `public.geometry` / `public.geography` types already exist and the
--     bridge is a strict no-op.
--   * When PostGIS lives anywhere else (remote: `extensions`), it creates
--     thin `public.geometry` / `public.geography` compatibility DOMAINS over
--     the base PostGIS types. Domains are binary-compatible aliases: no data
--     is moved, PostGIS is neither relocated nor replaced, columns such as
--     `organization_offices.location_point` (already `extensions.geography`
--     on the remote) are untouched, and the registered geometry<->geography
--     casts keep working (verified: geography->geometry is an explicit cast,
--     geometry->geography implicit; domain arguments resolve to the base
--     type in function calls, so `extensions.ST_*` calls are unaffected).
--   * Base types are resolved dynamically, so the bridge is placement-agnostic
--     instead of hardcoding a schema. If no non-public PostGIS types exist it
--     raises loudly rather than guessing.
--
-- Idempotency:
--   The existence guard makes the block a no-op whenever the public types
--   already exist; migration history additionally records it exactly once.
--
-- Rollback boundary:
--   This file is append-only (never edit applied migrations). To undo:
--   revert this PR (removing the file) together with the dependent RPC
--   redefinitions it unblocks (20260803223744, 20260804005812); on the
--   extensions-placement only, `DROP DOMAIN public.geometry, public.geography`
--   restores the pre-bridge state once the dependent function bodies are
--   reverted. On the public-placement (clean replay) the bridge created
--   nothing, so there is nothing to roll back.

DO $bridge$
DECLARE
  v_geometry regtype;
  v_geography regtype;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE t.typname IN ('geometry', 'geography')
      AND n.nspname = 'public'
  ) THEN
    RETURN;
  END IF;

  SELECT (n.nspname || '.' || t.typname)::regtype
  INTO v_geometry
  FROM pg_type AS t
  JOIN pg_namespace AS n ON n.oid = t.typnamespace
  WHERE t.typname = 'geometry'
    AND n.nspname NOT IN ('public', 'pg_catalog', 'information_schema')
  ORDER BY (n.nspname = 'extensions') DESC, n.nspname
  LIMIT 1;

  SELECT (n.nspname || '.' || t.typname)::regtype
  INTO v_geography
  FROM pg_type AS t
  JOIN pg_namespace AS n ON n.oid = t.typnamespace
  WHERE t.typname = 'geography'
    AND n.nspname NOT IN ('public', 'pg_catalog', 'information_schema')
  ORDER BY (n.nspname = 'extensions') DESC, n.nspname
  LIMIT 1;

  IF v_geometry IS NULL OR v_geography IS NULL THEN
    RAISE EXCEPTION
      'placement compat bridge: PostGIS types not found outside public (geometry: %, geography: %)',
      v_geometry, v_geography;
  END IF;

  EXECUTE format('CREATE DOMAIN public.geometry AS %s', v_geometry);
  EXECUTE format('CREATE DOMAIN public.geography AS %s', v_geography);
END
$bridge$;
