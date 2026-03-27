-- Migration: Fix Supabase Advisor Warnings
-- Applied: 2026-03-26
-- Fixes: search_path mutable, RLS initplan re-evaluation, multiple permissive policies, unindexed FKs

-- ============================================================================
-- 1. FIX: Function search_path mutable (SECURITY)
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''  -- Empty search_path for security
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2. FIX: RLS policies with auth.uid() re-evaluation (PERFORMANCE)
-- Wrap auth.uid() and auth.jwt() in (SELECT ...) for single evaluation per query
-- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
-- ============================================================================

-- 2.1 organizations table
DROP POLICY IF EXISTS organizations_select_for_active_members ON organizations;
CREATE POLICY organizations_select_for_active_members ON organizations
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = organizations.id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
    )
  );

DROP POLICY IF EXISTS organizations_insert_for_owner ON organizations;
CREATE POLICY organizations_insert_for_owner ON organizations
  FOR INSERT TO public
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS organizations_update_for_owner ON organizations;
CREATE POLICY organizations_update_for_owner ON organizations
  FOR UPDATE TO public
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS organizations_delete_for_owner ON organizations;
CREATE POLICY organizations_delete_for_owner ON organizations
  FOR DELETE TO public
  USING (owner_user_id = (SELECT auth.uid()));

-- 2.2 memberships table - consolidate + fix RLS initplan
-- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
DROP POLICY IF EXISTS memberships_select_for_self_or_invited_email ON memberships;
DROP POLICY IF EXISTS memberships_select_org_active_members ON memberships;
DROP POLICY IF EXISTS memberships_insert_owner_membership ON memberships;
DROP POLICY IF EXISTS memberships_insert_invitation_by_owner ON memberships;
DROP POLICY IF EXISTS memberships_update_for_self_or_invite_claim ON memberships;

-- Consolidated SELECT policy (combines self/invited_email and org active members)
CREATE POLICY memberships_select ON memberships
  FOR SELECT TO public
  USING (
    -- Can see own memberships
    user_id = (SELECT auth.uid())
    -- Can see invitations to own email
    OR (
      status = 'invited'::membership_status
      AND invited_email IS NOT NULL
      AND lower(invited_email) = lower(COALESCE((SELECT auth.jwt()) ->> 'email', ''))
    )
    -- Can see other members of organizations where user is active member
    OR is_active_member_of_organization(organization_id)
  );

-- Consolidated INSERT policy (combines owner_membership and invitation_by_owner)
CREATE POLICY memberships_insert ON memberships
  FOR INSERT TO public
  WITH CHECK (
    -- Owner creating their own membership
    (
      user_id = (SELECT auth.uid())
      AND role = 'owner'::membership_role
      AND status = 'active'::membership_status
      AND EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = memberships.organization_id
          AND o.owner_user_id = (SELECT auth.uid())
      )
    )
    -- Owner inviting someone
    OR (
      invited_email IS NOT NULL
      AND status = 'invited'::membership_status
      AND user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = memberships.organization_id
          AND o.owner_user_id = (SELECT auth.uid())
      )
    )
  );

-- UPDATE policy with fixed auth functions
CREATE POLICY memberships_update ON memberships
  FOR UPDATE TO public
  USING (
    user_id = (SELECT auth.uid())
    OR (
      status = 'invited'::membership_status
      AND invited_email IS NOT NULL
      AND lower(invited_email) = lower(COALESCE((SELECT auth.jwt()) ->> 'email', ''))
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      invited_email IS NOT NULL
      AND lower(invited_email) = lower(COALESCE((SELECT auth.jwt()) ->> 'email', ''))
    )
  );

-- 2.3 employee_profiles table
DROP POLICY IF EXISTS employee_profiles_select_org_active_members ON employee_profiles;
CREATE POLICY employee_profiles_select_org_active_members ON employee_profiles
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM memberships target_membership
      JOIN memberships self_membership 
        ON self_membership.organization_id = target_membership.organization_id
      WHERE target_membership.id = employee_profiles.membership_id
        AND self_membership.user_id = (SELECT auth.uid())
        AND self_membership.status = 'active'::membership_status
        AND target_membership.status = 'active'::membership_status
    )
  );

-- 2.4 user_profiles table - consolidate + fix
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS user_profiles_select_org_active_members ON user_profiles;

-- Consolidated SELECT policy for user_profiles
CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT TO public
  USING (
    -- Can view own profile
    (SELECT auth.uid()) = id
    -- Can view profiles of people in same organization
    OR EXISTS (
      SELECT 1
      FROM memberships target_membership
      JOIN memberships self_membership 
        ON self_membership.organization_id = target_membership.organization_id
      WHERE target_membership.user_id = user_profiles.id
        AND target_membership.status = 'active'::membership_status
        AND self_membership.user_id = (SELECT auth.uid())
        AND self_membership.status = 'active'::membership_status
    )
  );

-- Fix INSERT and UPDATE policies too
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY user_profiles_insert ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 2.5 attendance_records table
DROP POLICY IF EXISTS "Members can view own attendance records" ON attendance_records;
CREATE POLICY attendance_records_select ON attendance_records
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = attendance_records.membership_id
        AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can insert own attendance records" ON attendance_records;
CREATE POLICY attendance_records_insert ON attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = attendance_records.membership_id
        AND m.organization_id = attendance_records.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
    )
  );

DROP POLICY IF EXISTS "Members can update own attendance records" ON attendance_records;
CREATE POLICY attendance_records_update ON attendance_records
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = attendance_records.membership_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = attendance_records.membership_id
        AND m.organization_id = attendance_records.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
    )
  );

-- 2.6 organization_offices table
DROP POLICY IF EXISTS organization_offices_insert_for_management ON organization_offices;
CREATE POLICY organization_offices_insert_for_management ON organization_offices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
        AND m.role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS organization_offices_update_for_management ON organization_offices;
CREATE POLICY organization_offices_update_for_management ON organization_offices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
        AND m.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
        AND m.role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS organization_offices_delete_for_management ON organization_offices;
CREATE POLICY organization_offices_delete_for_management ON organization_offices
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = organization_offices.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'::membership_status
        AND m.role IN ('owner', 'admin', 'manager')
    )
  );

-- ============================================================================
-- 3. FIX: Unindexed foreign keys (PERFORMANCE)
-- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
-- ============================================================================

-- Index for attendance_membership_org_fk (membership_id, organization_id)
CREATE INDEX IF NOT EXISTS idx_attendance_records_membership_org 
  ON attendance_records (membership_id, organization_id);

-- Index for memberships_user_id_fkey
CREATE INDEX IF NOT EXISTS idx_memberships_user_id 
  ON memberships (user_id);

-- ============================================================================
-- NOTE: The following warnings require manual action in the Supabase Dashboard:
-- 
-- 1. auth_leaked_password_protection (SECURITY)
--    Dashboard → Authentication → Settings → Enable "Leaked password protection"
--    https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
-- ============================================================================
