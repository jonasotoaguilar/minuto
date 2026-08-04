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

  it('hardens every SECURITY DEFINER RPC to an empty search_path (F04)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260803223744_harden_rpc_search_path.sql',
      ),
      'utf8',
    );

    const hardenedFunctions = [
      'public.accept_membership_invitation(text)',
      'public.attendance_clock_in(uuid, uuid, date, double precision, double precision, double precision, uuid, boolean)',
      'public.attendance_clock_out(uuid, double precision, double precision, double precision, boolean, timestamp with time zone, boolean)',
      'public.auto_close_stale_shifts()',
      'public.create_membership_invitation(uuid, text, text)',
      'public.create_organization_office(uuid, text, text, double precision, double precision)',
      'public.create_organization_with_owner(text, text, text, text, text, double precision, double precision)',
      'public.delete_expired_membership_invitations()',
      'public.delete_membership(uuid)',
      'public.get_attendance_history_page(uuid, uuid, integer, integer, integer, integer)',
      'public.get_attendance_records(uuid, uuid, date, date)',
      'public.get_open_shift(uuid)',
      'public.get_organization_team_members(uuid)',
      'public.handle_new_user_profile()',
      'public.is_active_member_of_organization(uuid)',
      'public.list_my_membership_invitations(text)',
      'public.list_pending_membership_invitations(uuid)',
      'public.revoke_membership_invitation(uuid)',
      'public.rls_auto_enable()',
      'public.suspend_membership(uuid)',
      'public.update_employee_profile(uuid, numeric, numeric, text, text, date)',
      'public.update_employee_profile(uuid, numeric, numeric, text, text, date, numeric)',
      'public.update_membership_role(uuid, text)',
      'public.update_organization_settings(uuid, text, text)',
    ];

    for (const signature of hardenedFunctions) {
      expect(sql).toContain(
        `ALTER FUNCTION ${signature} SET search_path = '';`,
      );
    }

    expect(sql).not.toContain("SET search_path TO 'public';");

    const executableLines = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'));
    expect(executableLines.join('\n')).not.toContain("search_path TO 'public'");
  });

  it('qualifies table references in recreated RPC bodies (F04)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260803223744_harden_rpc_search_path.sql',
      ),
      'utf8',
    );

    expect(sql).toContain('FROM public.organization_offices oo');
    expect(sql).toContain('FROM public.organization_offices\n');
  });

  it('recreates RPCs with unqualified table refs with empty search_path (F04)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260803223744_harden_rpc_search_path.sql',
      ),
      'utf8',
    );

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.get_organization_offices',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.validate_proximity',
    );
    const recreated = sql.split('CREATE OR REPLACE FUNCTION');
    for (const fn of recreated) {
      if (
        !fn.includes('get_organization_offices') &&
        !fn.includes('validate_proximity')
      ) {
        continue;
      }
      expect(fn).toContain("SET search_path = ''");
      expect(fn).toContain('SECURITY DEFINER');
    }
  });

  it('revokes EXECUTE from PUBLIC/anon and grants authenticated only (F04)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260803231445_revoke_unnecessary_execute.sql',
      ),
      'utf8',
    );

    const clientRpcs = [
      'accept_membership_invitation(text)',
      'attendance_clock_in(uuid, uuid, date, double precision, double precision, double precision, uuid, boolean)',
      'attendance_clock_out(uuid, double precision, double precision, double precision, boolean, timestamp with time zone, boolean)',
      'create_membership_invitation(uuid, text, text)',
      'create_organization_office(uuid, text, text, double precision, double precision)',
      'create_organization_with_owner(text, text, text, text, text, double precision, double precision)',
      'delete_membership(uuid)',
      'get_attendance_history_page(uuid, uuid, integer, integer, integer, integer)',
      'get_attendance_records(uuid, uuid, date, date)',
      'get_open_shift(uuid)',
      'get_organization_offices(uuid)',
      'get_organization_team_members(uuid)',
      'list_my_membership_invitations(text)',
      'list_pending_membership_invitations(uuid)',
      'revoke_membership_invitation(uuid)',
      'suspend_membership(uuid)',
      'update_employee_profile(uuid, numeric, numeric, text, text, date)',
      'update_employee_profile(uuid, numeric, numeric, text, text, date, numeric)',
      'update_membership_role(uuid, text)',
      'update_organization_settings(uuid, text, text)',
      'validate_proximity(uuid, double precision, double precision, double precision)',
    ];

    for (const signature of clientRpcs) {
      expect(sql).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon;`,
      );
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`,
      );
    }

    const systemOnly = [
      'auto_close_stale_shifts()',
      'delete_expired_membership_invitations()',
      'handle_new_user_profile()',
      'rls_auto_enable()',
    ];
    for (const signature of systemOnly) {
      expect(sql).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`,
      );
    }
    expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION public.auto_close');
    expect(sql).not.toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_expired',
    );

    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO supabase_auth_admin;',
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.is_active_member_of_organization(uuid) TO anon, authenticated, service_role;',
    );
  });

  it('preserves service_role EXECUTE while hardening client roles (F04)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260803231445_revoke_unnecessary_execute.sql',
      ),
      'utf8',
    );

    expect(sql).not.toContain('FROM service_role');
    expect(sql).not.toContain('TO service_role;');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.is_active_member_of_organization(uuid) TO anon, authenticated, service_role;',
    );
  });

  it('converts only offices RPCs to SECURITY INVOKER with ACLs untouched (F04)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260804005812_invoker_conversion_and_revoke_ambiguity.sql',
      ),
      'utf8',
    );

    expect(sql).not.toContain('REVOKE');
    expect(sql).not.toContain('GRANT ');

    const functions = sql.split('CREATE OR REPLACE FUNCTION');
    const officesFn = functions.find((f) =>
      f.startsWith(' public.get_organization_offices'),
    );
    const proximityFn = functions.find((f) =>
      f.startsWith(' public.validate_proximity'),
    );
    const revokeFn = functions.find((f) =>
      f.startsWith(' public.revoke_membership_invitation'),
    );

    for (const fn of [officesFn, proximityFn]) {
      expect(fn).toContain('SECURITY INVOKER');
      expect(fn).toContain("SET search_path = ''");
      expect(fn).toContain('IF auth.uid() IS NULL THEN');
    }
    expect(revokeFn).toContain('SECURITY DEFINER');
    expect(revokeFn).toContain("SET search_path = ''");

    expect(sql.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(3);
  });

  it('qualifies OUT-param-colliding columns in revoke_membership_invitation (42702)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260804005812_invoker_conversion_and_revoke_ambiguity.sql',
      ),
      'utf8',
    );

    const functions = sql.split('CREATE OR REPLACE FUNCTION');
    const revokeFn = functions.find((f) =>
      f.startsWith(' public.revoke_membership_invitation'),
    );
    expect(revokeFn).toBeDefined();
    expect(revokeFn).toBeTruthy();
    const bodyMatch = (revokeFn ?? '').match(/\$function\$(.*)\$function\$/s);
    const body = bodyMatch?.[1] ?? '';

    const badPatterns = [
      /\bWHERE\s+organization_id\s*=/gi,
      /\bAND\s+organization_id\s*=/gi,
      /\bWHERE\s+status\s*=/gi,
      /\bAND\s+status\s*=/gi,
      /\bWHERE\s+user_id\s*=/gi,
      /\bAND\s+user_id\s*=/gi,
      /\bWHERE\s+id\s*=/gi,
      /\bAND\s+id\s*=/gi,
      /\bOR\s+id\s*=/gi,
      /\bSET\s+id\s*=/gi,
      /\bORDER BY\s+id\b/gi,
      /\bGROUP BY\s+id\b/gi,
    ];
    for (const pattern of badPatterns) {
      expect(body).not.toMatch(pattern);
    }
    expect(body).toMatch(/FROM public\.memberships AS m/);
    expect(body).toMatch(/m\.organization_id\s*=/);
    expect(body).toMatch(/m\.user_id\s*=/);
    expect(body).toMatch(/m\.status\s*=/);
    expect(body).toMatch(/memberships\.id\s*=/);
    expect(body).toMatch(/v_invitation\.id/);
    expect(body).not.toMatch(/\bSELECT\s+id\b/);
    expect(body).toMatch(/can_manage_membership_role/);
    expect(body).toMatch(/auth\.uid\(\)/);
  });

  it('adds authorization guards to create/delete/suspend RPCs (F04)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260804011530_rpc_authorization_guards.sql',
      ),
      'utf8',
    );

    const executable = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executable).not.toContain('REVOKE');
    expect(executable).not.toContain('GRANT ');

    const functions = sql.split('CREATE OR REPLACE FUNCTION');
    const guards: Record<string, string[]> = {
      create_membership_invitation: [
        'auth.uid()',
        'v_actor_role',
        'No tenés permisos para invitar en esta organización.',
        'can_manage_membership_role',
        'FROM public.memberships AS m',
      ],
      delete_membership: [
        'auth.uid()',
        'MEMBERSHIP_NOT_FOUND',
        'No tenés permisos para eliminar este miembro.',
        'can_manage_membership_role',
        'FROM public.memberships AS m',
      ],
      suspend_membership: [
        'auth.uid()',
        'MEMBERSHIP_NOT_FOUND',
        'No tenés permisos para suspender este miembro.',
        'can_manage_membership_role',
        'FROM public.memberships AS m',
      ],
    };

    expect(sql.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(3);
    for (const [name, needles] of Object.entries(guards)) {
      const fn = functions.find((f) => f.startsWith(` public.${name}`));
      expect(fn).toBeDefined();
      expect(fn).toBeTruthy();
      expect(fn).toContain('SECURITY DEFINER');
      expect(fn).toContain("SET search_path = ''");
      for (const needle of needles) {
        expect(fn).toContain(needle);
      }
    }
  });

  it('qualifies OUT-param-colliding columns in guarded RPC bodies (42702 class)', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260804011530_rpc_authorization_guards.sql',
      ),
      'utf8',
    );

    const functions = sql.split('CREATE OR REPLACE FUNCTION');
    const createFn = functions.find((f) =>
      f.startsWith(' public.create_membership_invitation'),
    );
    const createBody =
      (createFn ?? '').match(/\$function\$(.*)\$function\$/s)?.[1] ?? '';
    const badPatterns = [
      /\bWHERE\s+organization_id\s*=/gi,
      /\bAND\s+organization_id\s*=/gi,
      /\bWHERE\s+role\s*=/gi,
      /\bAND\s+role\s*=/gi,
      /\bWHERE\s+status\s*=/gi,
      /\bAND\s+status\s*=/gi,
      /\bWHERE\s+user_id\s*=/gi,
      /\bAND\s+user_id\s*=/gi,
    ];
    for (const pattern of badPatterns) {
      expect(createBody).not.toMatch(pattern);
    }
    expect(createBody).toMatch(/m\.organization_id\s*=/);
    expect(createBody).toMatch(/m\.user_id\s*=/);
    expect(createBody).toMatch(/m\.status\s*=/);
    expect(createBody).toMatch(/m\.role\b/);
  });
});
