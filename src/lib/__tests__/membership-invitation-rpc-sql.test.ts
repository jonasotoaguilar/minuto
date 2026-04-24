import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('membership invitation SQL migration regression', () => {
  it('contains lifecycle migration for invitation renew, defaults, and cleanup cron', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase/migrations/20260423230419_member_admin_and_invitation_lifecycle.sql',
    );

    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.list_my_membership_invitations',
    );
    expect(sql).toContain(
      "VALUES (v_invitation.id, 'General', 'General', current_date)",
    );
    expect(sql).toContain('ON CONFLICT (membership_id)');
    expect(sql).toContain(
      'ON CONFLICT (organization_id, invited_email) WHERE invited_email IS NOT NULL',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.suspend_membership',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.delete_membership',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.delete_expired_membership_invitations()',
    );
    expect(sql).toContain('cleanup-expired-membership-invitations');
    expect(sql).toContain(
      '$cron$SELECT public.delete_expired_membership_invitations()$cron$',
    );
  });
});
