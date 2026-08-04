export const DEPARTMENT_FILTERS = {
  all: 'ALL',
} as const;

export const DEFAULT_DEPARTMENT = 'General';

export type MembershipRole = 'owner' | 'admin' | 'manager' | 'employee';

export type TeamMember = {
  breakDurationHours: number;
  department: string;
  hireDate: string;
  id: string;
  initials: string;
  email: string;
  phone: string;
  name: string;
  position: string;
  role: MembershipRole;
  roleLabel: string;
  shiftDurationHours: number;
  weeklyHours: number;
};

export function filterTeamMembers(
  members: TeamMember[],
  searchQuery: string,
  selectedDepartment: string,
) {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return members.filter((member) => {
    const matchesDepartment =
      selectedDepartment === DEPARTMENT_FILTERS.all ||
      member.department === selectedDepartment;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      member.name.toLowerCase().includes(normalizedSearch) ||
      member.roleLabel.toLowerCase().includes(normalizedSearch) ||
      member.department.toLowerCase().includes(normalizedSearch);

    return matchesDepartment && matchesSearch;
  });
}

export function deriveName(
  fullName: string | undefined,
  email: string | null,
  userId: string | null,
  fallbackId: string,
) {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  if (email) {
    const localPart = email.split('@')[0] ?? '';
    const fromEmail = localPart
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((token) => token[0].toUpperCase() + token.slice(1).toLowerCase())
      .join(' ');
    if (fromEmail) {
      return fromEmail;
    }
  }

  if (userId) {
    return `Member ${userId.slice(0, 6)}`;
  }

  return `Member ${fallbackId.slice(0, 6)}`;
}

export function deriveInitials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return 'MM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function normalizeDepartment(rawDepartment: string | null | undefined) {
  if (!rawDepartment?.trim()) return DEFAULT_DEPARTMENT;
  return rawDepartment.trim();
}

export function mapMembershipRole(role: MembershipRole) {
  if (role === 'owner') return 'Organization Owner';
  if (role === 'admin') return 'Administrator';
  if (role === 'manager') return 'Team Manager';
  return 'Employee';
}

export function getRoleLabel(role: MembershipRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrador';
    case 'manager':
      return 'Manager';
    case 'employee':
      return 'Empleado';
    default:
      return role;
  }
}
