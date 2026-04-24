import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useInvitationScreen } from '@/hooks/use-invitation-screen';
import {
  acceptMembershipInvitation,
  listMyMembershipInvitations,
} from '@/lib/organization-invitations';
import { supabase } from '@/lib/supabase';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefreshOrganizations = jest.fn();
const mockSetActiveOrganizationById = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('@/lib/organization-invitations', () => ({
  acceptMembershipInvitation: jest.fn(),
  listMyMembershipInvitations: jest.fn(),
  normalizeInvitationCode: (value: string) =>
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, '')
      .toUpperCase(),
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({
    refreshOrganizations: mockRefreshOrganizations,
    setActiveOrganizationById: mockSetActiveOrganizationById,
  }),
}));

describe('useInvitationScreen', () => {
  const mockGetUser = supabase.auth.getUser as jest.Mock;
  const mockAcceptMembershipInvitation =
    acceptMembershipInvitation as jest.Mock;
  const mockListMyMembershipInvitations =
    listMyMembershipInvitations as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRefreshOrganizations.mockResolvedValue(undefined);
    mockSetActiveOrganizationById.mockResolvedValue(undefined);
  });

  it('moves to ready-for-auth when there is no active session', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useInvitationScreen(' invite_123 '));

    await waitFor(() => {
      expect(result.current.status).toBe('ready-for-auth');
    });

    act(() => {
      result.current.goToLogin();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/login',
      params: { redirect: '/invite/INVITE_123' },
    });

    act(() => {
      result.current.goToRegister();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/register',
      params: { redirect: '/invite/INVITE_123' },
    });
  });

  it('loads active invitations but does not auto-accept', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-id',
        },
      },
      error: null,
    });
    mockListMyMembershipInvitations.mockResolvedValueOnce([
      {
        createdAt: null,
        id: 'invite-id',
        invitedEmail: 'persona@empresa.com',
        invitationCode: 'ACME-123',
        invitationExpiresAt: '2026-05-01T10:00:00.000Z',
        organizationId: 'org-id',
        role: 'employee',
        status: 'invited',
      },
    ]);

    const { result } = renderHook(() => useInvitationScreen('acme-123'));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(mockListMyMembershipInvitations).toHaveBeenCalledWith('ACME-123');
    expect(result.current.selectedInvitation?.id).toBe('invite-id');
    expect(mockAcceptMembershipInvitation).not.toHaveBeenCalled();
  });

  it('accepts invitation only when user confirms', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-id',
        },
      },
      error: null,
    });
    mockListMyMembershipInvitations.mockResolvedValueOnce([
      {
        createdAt: null,
        id: 'invite-id',
        invitedEmail: 'persona@empresa.com',
        invitationCode: 'ACME-123',
        invitationExpiresAt: '2026-05-01T10:00:00.000Z',
        organizationId: 'org-id',
        role: 'employee',
        status: 'invited',
      },
    ]);
    mockAcceptMembershipInvitation.mockResolvedValueOnce({
      id: 'membership-id',
      organizationId: 'org-id',
      organizationName: 'Acme',
      role: 'employee',
      status: 'active',
    });

    const { result } = renderHook(() => useInvitationScreen('acme-123'));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await act(async () => {
      await result.current.acceptSelectedInvitation();
    });

    expect(mockAcceptMembershipInvitation).toHaveBeenCalledWith('ACME-123');
    expect(mockRefreshOrganizations).toHaveBeenCalledTimes(1);
    expect(mockSetActiveOrganizationById).toHaveBeenCalledWith('org-id');
    expect(result.current.status).toBe('accepted');
  });

  it('moves to error when loading invitations fails', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-id',
        },
      },
      error: null,
    });
    mockListMyMembershipInvitations.mockRejectedValueOnce(
      new Error('Invitación vencida.'),
    );

    const { result } = renderHook(() => useInvitationScreen('invite-404'));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.errorMessage).toBe('Invitación vencida.');
    expect(mockRefreshOrganizations).not.toHaveBeenCalled();
  });

  it('preserves invite redirect through auth without auto-join', async () => {
    mockGetUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-id',
          },
        },
        error: null,
      });

    mockListMyMembershipInvitations.mockResolvedValueOnce([
      {
        createdAt: null,
        id: 'invite-id',
        invitedEmail: 'persona@empresa.com',
        invitationCode: 'ROUNDTRIP-01',
        invitationExpiresAt: '2026-05-01T10:00:00.000Z',
        organizationId: 'org-after-login',
        role: 'employee',
        status: 'invited',
      },
    ]);

    const firstVisit = renderHook(() => useInvitationScreen('roundtrip-01'));

    await waitFor(() => {
      expect(firstVisit.result.current.status).toBe('ready-for-auth');
    });

    act(() => {
      firstVisit.result.current.goToLogin();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/login',
      params: { redirect: '/invite/ROUNDTRIP-01' },
    });

    firstVisit.unmount();

    const secondVisit = renderHook(() => useInvitationScreen('roundtrip-01'));

    await waitFor(() => {
      expect(secondVisit.result.current.status).toBe('ready');
    });

    expect(mockAcceptMembershipInvitation).not.toHaveBeenCalled();
    expect(secondVisit.result.current.selectedInvitation?.organizationId).toBe(
      'org-after-login',
    );
  });
});
