-- Corrective migration: version least-privilege table grants + cron parity
-- (F05 — L01 child PR 4)
--
-- Table-grant posture (evidence-based):
--   - Live local ACLs (pre-migration): every core table carries the extras
--     Dxtm (DELETE is 'd'; D=TRUNCATE, x=REFERENCES, t=TRIGGER, m=MAINTAIN)
--     for anon/authenticated/service_role; only organization_offices grants
--     authenticated arwd (SELECT/INSERT/UPDATE/DELETE). Live remote ACLs are
--     wider (full arwdDxtm to all three roles) — this migration versioned
--     here brings both to the same least-privilege posture.
--   - Client surface (repository evidence): the app talks to tables almost
--     exclusively through SECURITY DEFINER RPCs (which run as postgres and
--     need no client grants). The ONLY direct table consumer is
--     src/hooks/use-organization.tsx fetchOrganizationSummaries, which reads
--     memberships with an embedded organizations relation (PostgREST embed
--     requires SELECT on both tables). Additionally, child PR 3b converted
--     get_organization_offices and validate_proximity to SECURITY INVOKER,
--     which execute as the caller and therefore need authenticated SELECT on
--     organization_offices. All other tables are RPC-only surfaces.
--   - Posture applied here:
--       anon:            no table privileges at all (no anon surface; RPC
--                        EXECUTE already revoked in child PR 3a).
--       authenticated:   SELECT on memberships, organizations, and
--                        organization_offices (client read + INVOKER RPCs).
--                        No INSERT/UPDATE/DELETE anywhere: every write path
--                        is a DEFINER RPC; RLS write policies remain as
--                        defense-in-depth but are not reachable without a
--                        grant, which is the intended least-privilege state.
--       service_role:    no table privileges. There is no server-side
--                        consumer in this repository (no edge functions; no
--                        cron access — cron runs as postgres). If a future
--                        server-side consumer needs table access, it must
--                        add explicit grants.
--   This closes the memberships SELECT drift surfaced in earlier harnesses
--   (authenticated direct SELECT on memberships previously failed with
--   permission denied).
--
-- Cron parity (fresh-reset defect): migration 20260326064000 schedules
-- auto-close-stale-shifts guarded on the existence of the 'cron' schema, but
-- on a fresh replay pg_cron is only ensured later by 20260423202954
-- (`create extension if not exists "pg_cron"`), so the guard fails and the
-- job is silently never scheduled. Remote has both jobs; local reset only
-- had cleanup-expired-membership-invitations. This migration:
--   1. ensures pg_cron is installed (idempotent; schema pg_catalog matches
--      the remote placement),
--   2. idempotently re-schedules BOTH jobs (unschedule-if-present then
--      schedule) so every environment converges to the same two jobs with
--      the same schedules and commands, with no duplicates on re-run.
--
-- Out of scope (documented): HIBP re-enable is a remote dashboard operation
-- (separate follow-up); no function bodies/ACLs touched (child PRs 3a-c);
-- no old migration edited (append-only corrective migration).
--
-- Rollback: append-only; revert = compensating migration or revert the PR
-- before deploy (file is new, not yet applied anywhere).

-- 1) Least-privilege table grants (six core tables)

REVOKE ALL ON TABLE public.attendance_records FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public.employee_profiles FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public.memberships FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.memberships TO authenticated;

REVOKE ALL ON TABLE public.organization_offices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.organization_offices TO authenticated;

REVOKE ALL ON TABLE public.organizations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.organizations TO authenticated;

REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated, service_role;

-- 2) Cron parity: ensure pg_cron, then idempotently schedule both jobs

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";

DO $$
DECLARE
  v_job_id bigint;
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobname, schedule, command
    FROM (VALUES
      ('auto-close-stale-shifts', '0 * * * *', 'SELECT public.auto_close_stale_shifts()'),
      ('cleanup-expired-membership-invitations', '0 * * * *', 'SELECT public.delete_expired_membership_invitations()')
    ) AS j (jobname, schedule, command)
  LOOP
    SELECT jobid INTO v_job_id
    FROM cron.job
    WHERE jobname = v_job.jobname
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      v_job.jobname,
      v_job.schedule,
      v_job.command
    );
  END LOOP;
END
$$;
