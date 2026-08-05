import {
  normalizeTeamMemberRows,
  teamMemberRowsSchema,
} from '@/components/team/team-screen-data';

describe('team-screen-data', () => {
  const validRow = {
    id: 'membership-1',
    organization_id: 'org-1',
    user_id: 'user-1',
    invited_email: null,
    role: 'employee' as const,
    status: 'active' as const,
    member_position: 'Operario',
    department: 'General',
    hire_date: '2026-01-01',
    shift_duration_hours: 8,
    break_duration_hours: 0.75,
    weekly_hours: 40,
    full_name: 'Persona Uno',
    phone: '+56911111111',
    email: 'persona@empresa.com',
  };

  it('accepts well-formed RPC rows', () => {
    const parsed = teamMemberRowsSchema.safeParse([validRow]);

    expect(parsed.success).toBe(true);
  });

  it('rejects rows with an invalid role', () => {
    const parsed = teamMemberRowsSchema.safeParse([
      { ...validRow, role: 'superuser' },
    ]);

    expect(parsed.success).toBe(false);
  });

  it('normalizes rows into team members with derived fields', () => {
    const members = normalizeTeamMemberRows([validRow]);

    expect(members).toEqual([
      {
        breakDurationHours: 0.75,
        department: 'General',
        hireDate: '2026-01-01',
        email: 'persona@empresa.com',
        id: 'membership-1',
        initials: 'PU',
        name: 'Persona Uno',
        phone: '+56911111111',
        position: 'Operario',
        role: 'employee',
        roleLabel: 'Operario',
        shiftDurationHours: 8,
        weeklyHours: 40,
      },
    ]);
  });

  it('applies defaults when nullable fields are missing', () => {
    const members = normalizeTeamMemberRows([
      {
        ...validRow,
        full_name: null,
        hire_date: null,
        member_position: null,
        phone: null,
      },
    ]);

    expect(members[0]).toMatchObject({
      breakDurationHours: 0.75,
      hireDate: '',
      name: 'Member user-1',
      phone: '',
      position: '',
      roleLabel: 'Employee',
      shiftDurationHours: 8,
      weeklyHours: 40,
    });
  });
});
