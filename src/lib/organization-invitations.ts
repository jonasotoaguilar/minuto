import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const membershipRoleSchema = z.enum(['owner', 'admin', 'manager', 'employee']);

const pendingInvitationRowSchema = z.object({
  created_at: z.string().min(1).nullable().optional(),
  id: z.string().min(1),
  invited_email: z.string().email(),
  invitation_code: z.string().min(1),
  invitation_expires_at: z.string().nullable(),
  organization_id: z.string().min(1),
  role: membershipRoleSchema,
  status: z.literal('invited'),
});

const pendingInvitationRowsSchema = z.array(pendingInvitationRowSchema);

const revokedInvitationSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  status: z.literal('revoked'),
});

const acceptedInvitationSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  organization_name: z.string().min(1),
  role: membershipRoleSchema,
  status: z.literal('active'),
});

const suspendMembershipSchema = z.object({
  success: z.boolean(),
  membership_id: z.string().min(1),
  status: z.literal('suspended').optional(),
});

const deleteMembershipSchema = z.object({
  success: z.boolean(),
  membership_id: z.string().min(1),
});

export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export interface PendingMembershipInvitation {
  createdAt: string | null;
  id: string;
  invitedEmail: string;
  invitationCode: string;
  invitationExpiresAt: string | null;
  organizationId: string;
  role: MembershipRole;
  status: 'invited';
}

export interface RevokeMembershipInvitationResult {
  id: string;
  organizationId: string;
  status: 'revoked';
}

export interface AcceptMembershipInvitationResult {
  id: string;
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
  status: 'active';
}

export interface SuspendMembershipResult {
  membershipId: string;
  status: 'suspended';
  success: boolean;
}

export interface DeleteMembershipResult {
  membershipId: string;
  success: boolean;
}

/**
 * Normaliza un código de invitación desde texto libre.
 *
 * Reglas:
 * - recorta espacios
 * - elimina caracteres fuera de `[A-Za-z0-9_-]`
 * - convierte a mayúsculas
 */
export function normalizeInvitationCode(rawValue: string): string {
  return rawValue
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toUpperCase();
}

function normalizeRequiredInvitationCode(rawValue: string): string {
  const invitationCode = normalizeInvitationCode(rawValue);
  if (!invitationCode) {
    throw new Error('Código de invitación inválido.');
  }
  return invitationCode;
}

export function buildMembershipInvitationLink(
  rawInvitationCode: string,
  options?: { baseUrl?: string },
): string {
  const invitationCode = normalizeRequiredInvitationCode(rawInvitationCode);
  const pathname = `/invite/${invitationCode}`;

  if (!options?.baseUrl?.trim()) {
    return pathname;
  }

  return new URL(pathname, options.baseUrl).toString();
}

function mapPendingInvitation(
  row: z.infer<typeof pendingInvitationRowSchema>,
): PendingMembershipInvitation {
  return {
    createdAt: row.created_at ?? null,
    id: row.id,
    invitedEmail: row.invited_email,
    invitationCode: row.invitation_code,
    invitationExpiresAt: row.invitation_expires_at,
    organizationId: row.organization_id,
    role: row.role,
    status: row.status,
  };
}

export async function createMembershipInvitation(params: {
  invitedEmail: string;
  organizationId: string;
  role: MembershipRole;
}): Promise<PendingMembershipInvitation> {
  // RPC security-definer: valida permisos de invitación en backend.
  const { data, error } = await supabase.rpc('create_membership_invitation', {
    p_organization_id: params.organizationId,
    p_invited_email: params.invitedEmail,
    p_role: params.role,
  });

  if (error) throw new Error(error.message);

  const parsed = pendingInvitationRowSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('La invitación creada llegó con un formato inválido.');
  }

  return mapPendingInvitation(parsed.data);
}

export async function listPendingMembershipInvitations(
  organizationId: string,
): Promise<PendingMembershipInvitation[]> {
  // RPC security-definer: devuelve solo invitaciones pendientes de la organización.
  const { data, error } = await supabase.rpc(
    'list_pending_membership_invitations',
    {
      p_organization_id: organizationId,
    },
  );

  if (error) throw new Error(error.message);

  const parsed = pendingInvitationRowsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    throw new Error(
      'Las invitaciones pendientes llegaron con formato inválido.',
    );
  }

  return parsed.data.map(mapPendingInvitation);
}

export async function revokeMembershipInvitation(
  membershipId: string,
): Promise<RevokeMembershipInvitationResult> {
  // RPC security-definer: revoca (inhabilita) una invitación pendiente.
  const { data, error } = await supabase.rpc('revoke_membership_invitation', {
    p_membership_id: membershipId,
  });

  if (error) throw new Error(error.message);

  const parsed = revokedInvitationSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('La revocación llegó con un formato inválido.');
  }

  return {
    id: parsed.data.id,
    organizationId: parsed.data.organization_id,
    status: parsed.data.status,
  };
}

export async function listMyMembershipInvitations(
  invitationCode?: string,
): Promise<PendingMembershipInvitation[]> {
  const normalizedCode = invitationCode
    ? normalizeInvitationCode(invitationCode)
    : null;

  const { data, error } = await supabase.rpc('list_my_membership_invitations', {
    p_invitation_code:
      normalizedCode && normalizedCode.length > 0 ? normalizedCode : null,
  });

  if (error) throw new Error(error.message);

  const parsed = pendingInvitationRowsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    throw new Error(
      'Las invitaciones del usuario llegaron con formato inválido.',
    );
  }

  return parsed.data.map(mapPendingInvitation);
}

export async function acceptMembershipInvitation(
  code: string,
): Promise<AcceptMembershipInvitationResult> {
  // RPC security-definer: valida código, expiración, email y estado antes de activar membresía.
  const normalizedCode = normalizeRequiredInvitationCode(code);

  const { data, error } = await supabase.rpc('accept_membership_invitation', {
    p_invitation_code: normalizedCode,
  });

  if (error) throw new Error(error.message);

  const parsed = acceptedInvitationSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('La aceptación de invitación llegó con formato inválido.');
  }

  return {
    id: parsed.data.id,
    organizationId: parsed.data.organization_id,
    organizationName: parsed.data.organization_name,
    role: parsed.data.role,
    status: parsed.data.status,
  };
}

export async function suspendMembership(
  membershipId: string,
): Promise<SuspendMembershipResult> {
  const { data, error } = await supabase.rpc('suspend_membership', {
    p_membership_id: membershipId,
  });

  if (error) throw new Error(error.message);

  const parsed = suspendMembershipSchema.safeParse(data);
  if (
    !parsed.success ||
    !parsed.data.success ||
    parsed.data.status !== 'suspended'
  ) {
    throw new Error('La suspensión llegó con un formato inválido.');
  }

  return {
    membershipId: parsed.data.membership_id,
    status: 'suspended',
    success: parsed.data.success,
  };
}

export async function deleteMembership(
  membershipId: string,
): Promise<DeleteMembershipResult> {
  const { data, error } = await supabase.rpc('delete_membership', {
    p_membership_id: membershipId,
  });

  if (error) throw new Error(error.message);

  const parsed = deleteMembershipSchema.safeParse(data);
  if (!parsed.success || !parsed.data.success) {
    throw new Error('La eliminación llegó con un formato inválido.');
  }

  return {
    membershipId: parsed.data.membership_id,
    success: parsed.data.success,
  };
}
