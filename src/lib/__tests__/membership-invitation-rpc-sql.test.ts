import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('membership invitation SQL migration regression', () => {
  const lifecyclePath = join(
    process.cwd(),
    'supabase/migrations/20260423230419_member_admin_and_invitation_lifecycle.sql',
  );
  const fixPath = join(
    process.cwd(),
    'supabase/migrations/20260424220000_fix_portable_code_and_suspended_reuse.sql',
  );
  const ambiguityFixPath = join(
    process.cwd(),
    'supabase/migrations/20260424230000_fix_invitation_rpc_id_ambiguity.sql',
  );
  const invitationCodeAmbiguityFixPath = join(
    process.cwd(),
    'supabase/migrations/20260424235000_fix_invitation_rpc_invitation_code_ambiguity.sql',
  );

  it('contains lifecycle migration for invitation renew, defaults, and cleanup cron', () => {
    const sql = readFileSync(lifecyclePath, 'utf8');

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

  it('uses portable code generation without gen_random_bytes', () => {
    const sql = readFileSync(fixPath, 'utf8');

    expect(sql).not.toContain('gen_random_bytes');
    expect(sql).toContain('gen_random_uuid()');
    expect(sql).toContain(
      "upper(substring(replace(gen_random_uuid()::text,'-',''),1,12))",
    );
    expect(sql).toContain('LOOP');
    expect(sql).toContain('EXIT WHEN NOT EXISTS');
    expect(sql).toContain('invitation_code = v_generated_code');
  });

  it('reuses suspended memberships and preserves user_id on reinvite', () => {
    const sql = readFileSync(fixPath, 'utf8');

    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain("status = 'active'::public.membership_status");
    expect(sql).toContain('Ese email ya pertenece a la organización.');
    expect(sql).toMatch(/user_id\s*=\s*coalesce\s*\(\s*memberships\.user_id/i);
    expect(sql).toContain('INSERT INTO public.memberships');
    expect(sql).toContain('UPDATE public.memberships');
  });

  it('restores guarded accept logic with validation gates', () => {
    const sql = readFileSync(fixPath, 'utf8');

    expect(sql).toContain(
      "v_invitation.status <> 'invited'::public.membership_status",
    );
    expect(sql).toContain('Invitación no encontrada o vencida.');
    expect(sql).toContain('Esta invitación no corresponde a tu email.');
    expect(sql).toContain('La invitación está vencida.');
    expect(sql).toContain('Ya pertenecés a esta organización.');
    expect(sql).toContain("auth.jwt() ->> 'email'");
    expect(sql).toContain("upper(trim(coalesce(p_invitation_code, '')))");
  });

  it('preserves employee profile upsert in the accept function', () => {
    const sql = readFileSync(fixPath, 'utf8');

    expect(sql).toContain(
      "VALUES (v_invitation.id, 'General', 'General', current_date)",
    );
    expect(sql).toContain('ON CONFLICT (membership_id)');
    expect(sql).toContain(
      "position = coalesce(nullif(trim(employee_profiles.position), ''), 'General')",
    );
  });

  it('has a corrective migration that fixes ambiguous id references in invitation RPCs', () => {
    const sql = readFileSync(ambiguityFixPath, 'utf8');

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.create_membership_invitation',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.accept_membership_invitation',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.revoke_membership_invitation',
    );

    const functions = sql.split('CREATE OR REPLACE FUNCTION');
    const invitationFns = functions.filter(
      (f) =>
        f.includes('create_membership_invitation') ||
        f.includes('accept_membership_invitation') ||
        f.includes('revoke_membership_invitation'),
    );

    for (const fn of invitationFns) {
      const bodyMatch = fn.match(/\$function\$(.*)\$function\$/s);
      if (!bodyMatch) continue;
      const body = bodyMatch[1];
      const badPatterns = [
        /\bWHERE\s+id\s*[=<>]/gi,
        /\bAND\s+id\s*[=<>]/gi,
        /\bOR\s+id\s*[=<>]/gi,
        /\bSET\s+id\s*=/gi,
      ];
      for (const pattern of badPatterns) {
        expect(body).not.toMatch(pattern);
      }
    }
  });

  it('qualifies id as organizations.id or memberships.id in invitation functions', () => {
    const sql = readFileSync(ambiguityFixPath, 'utf8');

    expect(sql).toMatch(/organizations\.id\s*=/);
    expect(sql).toMatch(/memberships\.id\s*=/);
  });

  it('has a corrective migration that fixes ambiguous invitation_code references in invitation RPCs', () => {
    const sql = readFileSync(invitationCodeAmbiguityFixPath, 'utf8');

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.create_membership_invitation',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.accept_membership_invitation',
    );

    const functions = sql.split('CREATE OR REPLACE FUNCTION');
    const invitationFns = functions.filter(
      (f) =>
        f.includes('create_membership_invitation') ||
        f.includes('accept_membership_invitation'),
    );

    for (const fn of invitationFns) {
      const bodyMatch = fn.match(/\$function\$(.*)\$function\$/s);
      if (!bodyMatch) continue;
      const body = bodyMatch[1];
      const badPatterns = [
        /\bWHERE\s+invitation_code\s*=/gi,
        /\bAND\s+invitation_code\s*=/gi,
        /\bOR\s+invitation_code\s*=/gi,
      ];
      for (const pattern of badPatterns) {
        expect(body).not.toMatch(pattern);
      }
      expect(body).toMatch(/memberships\.invitation_code\s*=/);
    }
  });

  it('qualifies both id and invitation_code in the latest invitation ambiguity fix migration', () => {
    const sql = readFileSync(invitationCodeAmbiguityFixPath, 'utf8');

    expect(sql).toMatch(/organizations\.id\s*=/);
    expect(sql).toMatch(/memberships\.id\s*=/);
    expect(sql).toMatch(/memberships\.invitation_code\s*=/);
  });
});
