import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { buildAuthRouteWithRedirect } from '@/lib/auth-redirect';
import {
  acceptMembershipInvitation,
  listMyMembershipInvitations,
  normalizeInvitationCode,
  type PendingMembershipInvitation,
} from '@/lib/organization-invitations';
import { supabase } from '@/lib/supabase';

export type InvitationScreenStatus =
  | 'checking-session'
  | 'ready-for-auth'
  | 'ready'
  | 'accepting'
  | 'accepted'
  | 'error';

/**
 * Orquesta el flujo de aceptación de invitaciones en `/invite/[code]`.
 *
 * Contrato de estados:
 * - `checking-session`: validación inicial
 * - `ready-for-auth`: no hay sesión, mostrar CTAs de login/registro
 * - `accepting`: sesión válida, procesando RPC de aceptación
 * - `accepted`: invitación aceptada y organización activa sincronizada
 * - `error`: código inválido o rechazo backend
 */
export function useInvitationScreen(rawInvitationCode: string) {
  const router = useRouter();
  const { refreshOrganizations, setActiveOrganizationById } = useOrganization();
  const [status, setStatus] =
    useState<InvitationScreenStatus>('checking-session');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeInvitations, setActiveInvitations] = useState<
    PendingMembershipInvitation[]
  >([]);
  const [selectedInvitationId, setSelectedInvitationId] = useState<
    string | null
  >(null);

  const invitationCode = useMemo(
    () => normalizeInvitationCode(rawInvitationCode),
    [rawInvitationCode],
  );

  const redirectTo = useMemo(
    () => `/invite/${invitationCode || rawInvitationCode.trim()}`,
    [invitationCode, rawInvitationCode],
  );

  const goToLogin = useCallback(() => {
    // Preserva el destino `/invite/[code]` para retomar aceptación tras auth.
    router.push(buildAuthRouteWithRedirect('/login', redirectTo));
  }, [redirectTo, router]);

  const goToRegister = useCallback(() => {
    // Misma preservación de redirect para registro.
    router.push(buildAuthRouteWithRedirect('/register', redirectTo));
  }, [redirectTo, router]);

  const goToTeam = useCallback(() => {
    router.replace('/(tabs)/team');
  }, [router]);

  const selectedInvitation = useMemo(
    () =>
      activeInvitations.find(
        (invitation) => invitation.id === selectedInvitationId,
      ) ?? null,
    [activeInvitations, selectedInvitationId],
  );

  const acceptSelectedInvitation = useCallback(async () => {
    if (!selectedInvitation) {
      setStatus('error');
      setErrorMessage('No encontramos invitaciones activas para aceptar.');
      return;
    }

    setStatus('accepting');
    setErrorMessage('');

    try {
      const acceptance = await acceptMembershipInvitation(
        selectedInvitation.invitationCode,
      );
      await refreshOrganizations();
      await setActiveOrganizationById(acceptance.organizationId);
      setStatus('accepted');
    } catch (acceptError) {
      setStatus('error');
      setErrorMessage(
        acceptError instanceof Error
          ? acceptError.message
          : 'No pudimos aceptar la invitación.',
      );
    }
  }, [refreshOrganizations, selectedInvitation, setActiveOrganizationById]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!invitationCode) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage('Código de invitación inválido.');
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }

      if (!data.user) {
        if (!isMounted) return;
        setStatus('ready-for-auth');
        setErrorMessage('');
        return;
      }

      if (!isMounted) return;
      setStatus('checking-session');
      setErrorMessage('');

      try {
        const invitations = await listMyMembershipInvitations(invitationCode);

        if (!isMounted) return;

        if (invitations.length === 0) {
          setStatus('error');
          setErrorMessage(
            'No encontramos invitaciones activas para esta cuenta y código.',
          );
          setActiveInvitations([]);
          setSelectedInvitationId(null);
          return;
        }

        setActiveInvitations(invitations);
        setSelectedInvitationId(invitations[0]?.id ?? null);

        if (!isMounted) return;
        setStatus('ready');
      } catch (acceptError) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(
          acceptError instanceof Error
            ? acceptError.message
            : 'No pudimos aceptar la invitación.',
        );
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [invitationCode]);

  const selectInvitation = useCallback((invitationId: string) => {
    setSelectedInvitationId(invitationId);
  }, []);

  return {
    acceptSelectedInvitation,
    activeInvitations,
    errorMessage,
    goToLogin,
    goToRegister,
    goToTeam,
    invitationCode,
    selectInvitation,
    selectedInvitation,
    status,
  } as const;
}
