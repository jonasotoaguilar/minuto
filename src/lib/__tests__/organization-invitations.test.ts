import {
  acceptMembershipInvitation,
  buildMembershipInvitationLink,
  createMembershipInvitation,
  deleteMembership,
  listMyMembershipInvitations,
  listPendingMembershipInvitations,
  normalizeInvitationCode,
  revokeMembershipInvitation,
  suspendMembership,
} from '@/lib/organization-invitations';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockRpc = supabase.rpc as jest.Mock;

describe('organization invitations lib', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeInvitationCode', () => {
    it('normalizes plain code to uppercase and strips invalid chars', () => {
      expect(normalizeInvitationCode('  abc-123._  ')).toBe('ABC-123_');
    });

    it('does not parse links and only keeps allowed code characters', () => {
      expect(
        normalizeInvitationCode('https://minuto.app/invite/acme_2026-xy'),
      ).toBe('HTTPSMINUTOAPPINVITEACME_2026-XY');
    });
  });

  describe('buildMembershipInvitationLink', () => {
    it('builds relative link when base url is not provided', () => {
      expect(buildMembershipInvitationLink('team_1')).toBe('/invite/TEAM_1');
    });

    it('builds absolute link when base url is provided', () => {
      expect(
        buildMembershipInvitationLink('team_1', {
          baseUrl: 'https://app.minuto.dev/',
        }),
      ).toBe('https://app.minuto.dev/invite/TEAM_1');
    });
  });

  describe('rpc wrappers', () => {
    it('creates invitation and returns parsed data', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          id: 'membership-id',
          invited_email: 'invitee@minuto.dev',
          invitation_code: 'ABCD1234',
          invitation_expires_at: '2026-05-01T10:00:00.000Z',
          organization_id: 'org-id',
          role: 'employee',
          status: 'invited',
        },
        error: null,
      });

      await expect(
        createMembershipInvitation({
          organizationId: 'org-id',
          invitedEmail: 'invitee@minuto.dev',
          role: 'employee',
        }),
      ).resolves.toEqual({
        createdAt: null,
        id: 'membership-id',
        invitedEmail: 'invitee@minuto.dev',
        invitationCode: 'ABCD1234',
        invitationExpiresAt: '2026-05-01T10:00:00.000Z',
        organizationId: 'org-id',
        role: 'employee',
        status: 'invited',
      });

      expect(mockRpc).toHaveBeenCalledWith('create_membership_invitation', {
        p_organization_id: 'org-id',
        p_invited_email: 'invitee@minuto.dev',
        p_role: 'employee',
      });
    });

    it('bubbles backend permission error for unauthorized invitation creation', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'No tenés permisos para invitar miembros.',
        },
      });

      await expect(
        createMembershipInvitation({
          organizationId: 'org-id',
          invitedEmail: 'invitee@minuto.dev',
          role: 'employee',
        }),
      ).rejects.toThrow('No tenés permisos para invitar miembros.');
    });

    it('lists pending invitations as newest first payload', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'new',
            invited_email: 'b@minuto.dev',
            invitation_code: 'NEWCODE',
            invitation_expires_at: '2026-05-02T10:00:00.000Z',
            organization_id: 'org-id',
            role: 'manager',
            status: 'invited',
            created_at: '2026-04-02T10:00:00.000Z',
          },
          {
            id: 'old',
            invited_email: 'a@minuto.dev',
            invitation_code: 'OLDCODE',
            invitation_expires_at: '2026-05-01T10:00:00.000Z',
            organization_id: 'org-id',
            role: 'employee',
            status: 'invited',
            created_at: '2026-04-01T10:00:00.000Z',
          },
        ],
        error: null,
      });

      const result = await listPendingMembershipInvitations('org-id');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'new',
        invitedEmail: 'b@minuto.dev',
        role: 'manager',
      });
      expect(mockRpc).toHaveBeenCalledWith(
        'list_pending_membership_invitations',
        {
          p_organization_id: 'org-id',
        },
      );
    });

    it('lists my active invitations and prioritizes target code', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'invite-target',
            invited_email: 'persona@empresa.com',
            invitation_code: 'INVITE-TARGET',
            invitation_expires_at: '2026-05-02T10:00:00.000Z',
            organization_id: 'org-id',
            role: 'manager',
            status: 'invited',
          },
        ],
        error: null,
      });

      await expect(
        listMyMembershipInvitations(' invite-target '),
      ).resolves.toEqual([
        {
          createdAt: null,
          id: 'invite-target',
          invitedEmail: 'persona@empresa.com',
          invitationCode: 'INVITE-TARGET',
          invitationExpiresAt: '2026-05-02T10:00:00.000Z',
          organizationId: 'org-id',
          role: 'manager',
          status: 'invited',
        },
      ]);

      expect(mockRpc).toHaveBeenCalledWith('list_my_membership_invitations', {
        p_invitation_code: 'INVITE-TARGET',
      });
    });

    it('revokes invitation and returns revoked status payload', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          id: 'membership-id',
          organization_id: 'org-id',
          status: 'revoked',
        },
        error: null,
      });

      await expect(
        revokeMembershipInvitation('membership-id'),
      ).resolves.toEqual({
        id: 'membership-id',
        organizationId: 'org-id',
        status: 'revoked',
      });

      expect(mockRpc).toHaveBeenCalledWith('revoke_membership_invitation', {
        p_membership_id: 'membership-id',
      });
    });

    it('accepts invitation code and returns active membership payload', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          id: 'membership-id',
          organization_id: 'org-id',
          organization_name: 'Acme',
          role: 'employee',
          status: 'active',
        },
        error: null,
      });

      await expect(acceptMembershipInvitation(' aBc-123 ')).resolves.toEqual({
        id: 'membership-id',
        organizationId: 'org-id',
        organizationName: 'Acme',
        role: 'employee',
        status: 'active',
      });

      expect(mockRpc).toHaveBeenCalledWith('accept_membership_invitation', {
        p_invitation_code: 'ABC-123',
      });
    });

    it('suspends a membership through rpc wrapper', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          membership_id: 'membership-id',
          status: 'suspended',
        },
        error: null,
      });

      await expect(suspendMembership('membership-id')).resolves.toEqual({
        membershipId: 'membership-id',
        status: 'suspended',
        success: true,
      });

      expect(mockRpc).toHaveBeenCalledWith('suspend_membership', {
        p_membership_id: 'membership-id',
      });
    });

    it('hard deletes a membership through rpc wrapper', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          membership_id: 'membership-id',
        },
        error: null,
      });

      await expect(deleteMembership('membership-id')).resolves.toEqual({
        membershipId: 'membership-id',
        success: true,
      });

      expect(mockRpc).toHaveBeenCalledWith('delete_membership', {
        p_membership_id: 'membership-id',
      });
    });

    it.each([
      'Invitación vencida.',
      'Invitación revocada.',
      'El email de la cuenta no coincide con la invitación.',
      'Ya sos miembro activo de esta organización.',
    ])('surfaces backend acceptance error: %s', async (backendErrorMessage) => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: backendErrorMessage },
      });

      await expect(acceptMembershipInvitation('INVITE-ERR')).rejects.toThrow(
        backendErrorMessage,
      );
    });
  });
});
