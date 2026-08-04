import {
  deriveInitials,
  deriveName,
  filterTeamMembers,
  getRoleLabel,
  mapMembershipRole,
  normalizeDepartment,
  type TeamMember,
} from '@/components/team/team-member';

const member = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  breakDurationHours: 0.75,
  department: 'General',
  hireDate: '2026-01-01',
  id: 'membership-1',
  initials: 'JU',
  email: '',
  phone: '',
  name: 'Juan Pérez',
  position: 'Operario',
  role: 'employee',
  roleLabel: 'Operario',
  shiftDurationHours: 8,
  weeklyHours: 40,
  ...overrides,
});

describe('team member model', () => {
  describe('deriveName', () => {
    it('uses the trimmed full name when present', () => {
      expect(deriveName('  Ana Pérez  ', null, null, 'id-1')).toBe('Ana Pérez');
    });

    it('derives a name from the email local part', () => {
      expect(
        deriveName(undefined, 'juan.perez@empresa.com', null, 'id-1'),
      ).toBe('Juan Perez');
    });

    it('falls back to a short user id label without email', () => {
      expect(deriveName(undefined, null, 'user-abc123', 'id-1')).toBe(
        'Member user-a',
      );
    });

    it('falls back to a short membership id label', () => {
      expect(deriveName(undefined, null, null, 'membership-xyz789')).toBe(
        'Member member',
      );
    });
  });

  describe('deriveInitials', () => {
    it('joins the first letters of two names', () => {
      expect(deriveInitials('Juan Pérez')).toBe('JP');
    });

    it('uses the first two letters of a single name', () => {
      expect(deriveInitials('Solo')).toBe('SO');
    });

    it('returns MM for an empty name', () => {
      expect(deriveInitials('   ')).toBe('MM');
    });
  });

  describe('normalizeDepartment', () => {
    it('defaults blank departments to General', () => {
      expect(normalizeDepartment(null)).toBe('General');
      expect(normalizeDepartment(undefined)).toBe('General');
      expect(normalizeDepartment('  ')).toBe('General');
    });

    it('trims a present department', () => {
      expect(normalizeDepartment('  Operaciones  ')).toBe('Operaciones');
    });
  });

  describe('mapMembershipRole', () => {
    it('maps each role to its english label', () => {
      expect(mapMembershipRole('owner')).toBe('Organization Owner');
      expect(mapMembershipRole('admin')).toBe('Administrator');
      expect(mapMembershipRole('manager')).toBe('Team Manager');
      expect(mapMembershipRole('employee')).toBe('Employee');
    });
  });

  describe('getRoleLabel', () => {
    it('maps each role to its display label', () => {
      expect(getRoleLabel('owner')).toBe('Owner');
      expect(getRoleLabel('admin')).toBe('Administrador');
      expect(getRoleLabel('manager')).toBe('Manager');
      expect(getRoleLabel('employee')).toBe('Empleado');
    });
  });

  describe('filterTeamMembers', () => {
    const members = [
      member({ id: 'm1', name: 'Ana Pérez', department: 'Operaciones' }),
      member({
        id: 'm2',
        name: 'Luis Soto',
        department: 'General',
        roleLabel: 'Supervisor',
      }),
      member({
        id: 'm3',
        name: 'Caro Díaz',
        department: 'Operaciones',
        roleLabel: 'Operario',
      }),
    ];

    it('returns all members for an empty search and the ALL department', () => {
      expect(filterTeamMembers(members, '', 'ALL')).toHaveLength(3);
    });

    it('filters by department', () => {
      const result = filterTeamMembers(members, '', 'Operaciones');
      expect(result.map((item) => item.id)).toEqual(['m1', 'm3']);
    });

    it('filters by name ignoring case and whitespace', () => {
      const result = filterTeamMembers(members, '  luis ', 'ALL');
      expect(result.map((item) => item.id)).toEqual(['m2']);
    });

    it('filters by role label', () => {
      const result = filterTeamMembers(members, 'supervisor', 'ALL');
      expect(result.map((item) => item.id)).toEqual(['m2']);
    });

    it('filters by department via search', () => {
      const result = filterTeamMembers(members, 'operaciones', 'ALL');
      expect(result.map((item) => item.id)).toEqual(['m1', 'm3']);
    });

    it('combines department and search filters', () => {
      const result = filterTeamMembers(members, 'ana', 'Operaciones');
      expect(result.map((item) => item.id)).toEqual(['m1']);
    });
  });
});
