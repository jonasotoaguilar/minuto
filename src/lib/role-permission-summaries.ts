import type { MembershipRole } from '@/lib/organization-invitations';

export type RolePermissionSummary = {
  description: string;
  title: string;
};

export const ROLE_PERMISSION_SUMMARIES: Record<
  MembershipRole,
  RolePermissionSummary
> = {
  owner: {
    title: 'Owner',
    description:
      'Control total: administra organización, miembros e invitaciones.',
  },
  admin: {
    title: 'Administrador',
    description:
      'Gestiona miembros, invitaciones y configuración operativa sin acceso a propiedad.',
  },
  manager: {
    title: 'Manager',
    description:
      'Coordina al equipo operativo, puede invitar empleados y suspender miembros gestionables.',
  },
  employee: {
    title: 'Empleado',
    description:
      'Acceso base para registrar asistencia y ver información propia.',
  },
};
