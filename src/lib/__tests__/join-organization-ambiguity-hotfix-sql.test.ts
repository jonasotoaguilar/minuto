import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('join organization ambiguity hotfix migration', () => {
  it('recreates invitation acceptance and RLS policies with qualified organization_id references', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase/migrations/20260423234500_fix_join_organization_ambiguity.sql',
    );

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(
      'DROP FUNCTION IF EXISTS public.accept_membership_invitation(text);',
    );
    expect(sql).toContain(
      'CREATE FUNCTION public.accept_membership_invitation(',
    );
    expect(sql).toContain(
      'WHERE memberships.organization_id = v_invitation.organization_id',
    );

    expect(sql).toContain(
      'DROP POLICY IF EXISTS memberships_select ON public.memberships;',
    );
    expect(sql).toContain(
      'public.is_active_member_of_organization(public.memberships.organization_id)',
    );

    expect(sql).toContain(
      'DROP POLICY IF EXISTS organization_offices_select_for_active_members ON public.organization_offices;',
    );
    expect(sql).toContain(
      'public.is_active_member_of_organization(public.organization_offices.organization_id)',
    );
  });
});
