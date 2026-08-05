import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OrganizationSetupView } from '@/components/organization-setup-view';
import { SecondaryScreenHeader } from '@/components/secondary-screen-header';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/error';
import {
  createMembershipInvitation,
  listPendingMembershipInvitations,
  type MembershipRole,
  type PendingMembershipInvitation,
  revokeMembershipInvitation,
} from '@/lib/organization-invitations';
import { useFeedback } from '@/theme/feedback';
import {
  Chip,
  GlassCard,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  TextField,
  ThemedText,
} from '@/theme/primitives';

const MANAGEMENT_ROLES: readonly MembershipRole[] = [
  'owner',
  'admin',
  'manager',
];

export default function InvitationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const feedback = useFeedback();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();

  const [pendingInvitations, setPendingInvitations] = useState<
    PendingMembershipInvitation[]
  >([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>('employee');
  const [inviteErrorMessage, setInviteErrorMessage] = useState('');
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [revokingInvitationId, setRevokingInvitationId] = useState<
    string | null
  >(null);
  const [copyingInvitationId, setCopyingInvitationId] = useState<string | null>(
    null,
  );

  const canManageOrganization = MANAGEMENT_ROLES.includes(
    activeOrganization?.membershipRole ?? 'employee',
  );

  const invitationRoleOptions = useMemo(() => {
    if (activeOrganization?.membershipRole === 'owner') {
      return ['admin', 'manager', 'employee'] as const;
    }
    if (activeOrganization?.membershipRole === 'admin') {
      return ['manager', 'employee'] as const;
    }
    if (activeOrganization?.membershipRole === 'manager') {
      return ['employee'] as const;
    }
    return [] as const;
  }, [activeOrganization?.membershipRole]);

  const loadPendingInvites = useCallback(async () => {
    if (!activeOrganization || !canManageOrganization) {
      setPendingInvitations([]);
      return;
    }

    setIsLoadingInvitations(true);
    setInviteErrorMessage('');

    try {
      const pendingRows = await listPendingMembershipInvitations(
        activeOrganization.id,
      );
      setPendingInvitations(pendingRows);
    } catch (error) {
      setInviteErrorMessage(
        getErrorMessage(error) ?? 'No se pudieron cargar invitaciones.',
      );
      setPendingInvitations([]);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [activeOrganization, canManageOrganization]);

  useEffect(() => {
    void loadPendingInvites();
  }, [loadPendingInvites]);

  const onCreateInvitation = useCallback(async () => {
    if (!activeOrganization) {
      return;
    }

    setInviteErrorMessage('');
    setInviteSuccessMessage('');

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setInviteErrorMessage('Ingresá un email válido para invitar.');
      return;
    }

    setIsSubmittingInvite(true);

    try {
      const invitation = await createMembershipInvitation({
        organizationId: activeOrganization.id,
        invitedEmail: normalizedEmail,
        role: inviteRole,
      });

      setInviteSuccessMessage('Invitación creada correctamente.');
      setInviteEmail('');
      setPendingInvitations((current) => {
        const withoutRenewed = current.filter(
          (item) => item.id !== invitation.id,
        );
        return [invitation, ...withoutRenewed];
      });
    } catch (error) {
      setInviteErrorMessage(
        getErrorMessage(error) ?? 'No se pudo crear la invitación.',
      );
    } finally {
      setIsSubmittingInvite(false);
    }
  }, [activeOrganization, inviteEmail, inviteRole]);

  const onRevokeInvitation = useCallback(
    async (invitation: PendingMembershipInvitation) => {
      setInviteErrorMessage('');
      setInviteSuccessMessage('');
      setRevokingInvitationId(invitation.id);

      try {
        await revokeMembershipInvitation(invitation.id);
        setPendingInvitations((current) =>
          current.filter((item) => item.id !== invitation.id),
        );
      } catch (error) {
        setInviteErrorMessage(
          getErrorMessage(error) ?? 'No se pudo revocar la invitación.',
        );
      } finally {
        setRevokingInvitationId(null);
      }
    },
    [],
  );

  const onCopyInvitationCode = useCallback(
    async (invitation: PendingMembershipInvitation) => {
      setInviteErrorMessage('');
      setInviteSuccessMessage('');
      setCopyingInvitationId(invitation.id);

      try {
        await Clipboard.setStringAsync(invitation.invitationCode);
        setInviteSuccessMessage(`Código ${invitation.invitationCode} copiado.`);
      } catch {
        setInviteErrorMessage('No se pudo copiar el código. Intentá de nuevo.');
      } finally {
        setCopyingInvitationId(null);
      }
    },
    [],
  );

  if (isLoadingOrganizations) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ThemedText colorToken="secondary" variant="label">
          Cargando organizaciones...
        </ThemedText>
      </Screen>
    );
  }

  if (!activeOrganization || isOrganizationSetupOpen) {
    return <OrganizationSetupView />;
  }

  return (
    <Screen
      scroll
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: theme.spacing.lg,
          paddingBottom: BottomTabInset + theme.spacing['2xl'],
        },
      ]}
      scrollProps={{ contentInsetAdjustmentBehavior: 'automatic' }}
    >
      <SecondaryScreenHeader
        onBack={() => router.back()}
        subtitle="Invitá por email y gestioná invitaciones pendientes."
        title="Miembros por invitar"
      />

      <GlassCard style={styles.invitationCard} variant="soft">
        <SectionHeader
          eyebrow="Invitaciones"
          subtitle="Administrá quién puede unirse a tu organización."
          title="Crear invitación"
        />

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setInviteEmail}
          placeholder="nombre@empresa.com"
          value={inviteEmail}
        />

        <ScrollView
          contentContainerStyle={styles.roleChipsRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {invitationRoleOptions.map((roleOption) => (
            <Chip
              key={roleOption}
              label={roleOption}
              onPress={() => setInviteRole(roleOption)}
              selected={roleOption === inviteRole}
              tone="brand"
            />
          ))}
        </ScrollView>

        <PrimaryButton
          disabled={isSubmittingInvite}
          label={
            isSubmittingInvite ? 'Creando invitación...' : 'Crear invitación'
          }
          loading={isSubmittingInvite}
          onPress={onCreateInvitation}
        />

        {inviteErrorMessage ? (
          <ThemedText colorToken="error" variant="bodySmall">
            {inviteErrorMessage}
          </ThemedText>
        ) : null}
        {inviteSuccessMessage ? (
          <ThemedText colorToken="secondary" variant="bodySmall">
            {inviteSuccessMessage}
          </ThemedText>
        ) : null}

        <View style={styles.pendingInvitationsList}>
          <SectionHeader
            eyebrow="Pendientes"
            subtitle="Copiá el código y compartilo con la persona invitada."
            title="Invitaciones activas"
          />

          {isLoadingInvitations ? (
            <ThemedText colorToken="secondary" variant="bodySmall">
              Cargando invitaciones...
            </ThemedText>
          ) : null}

          {!isLoadingInvitations && pendingInvitations.length === 0 ? (
            <ThemedText colorToken="secondary" variant="bodySmall">
              No hay invitaciones pendientes.
            </ThemedText>
          ) : null}

          {pendingInvitations.map((invitation) => (
            <GlassCard key={invitation.id} style={styles.pendingInvitationItem}>
              <ThemedText
                numberOfLines={2}
                style={styles.pendingInvitationEmail}
                variant="subtitle"
              >
                {invitation.invitedEmail}
              </ThemedText>

              <ThemedText
                colorToken="secondary"
                style={styles.pendingInvitationCode}
                variant="bodySmall"
              >
                Código: {invitation.invitationCode}
              </ThemedText>

              <View style={styles.pendingInvitationActions}>
                <SecondaryButton
                  disabled={copyingInvitationId === invitation.id}
                  fullWidth={false}
                  label={
                    copyingInvitationId === invitation.id
                      ? 'Copiando...'
                      : 'Copiar código'
                  }
                  onPress={() => {
                    void onCopyInvitationCode(invitation);
                  }}
                />
                <SecondaryButton
                  disabled={revokingInvitationId === invitation.id}
                  fullWidth={false}
                  label={
                    revokingInvitationId === invitation.id
                      ? 'Revocando...'
                      : 'Revocar'
                  }
                  onPress={() => {
                    feedback.show({
                      tone: 'info',
                      title: 'Revocar invitación',
                      message: `¿Querés revocar la invitación para ${invitation.invitedEmail}?`,
                      actionLabel: 'Revocar',
                      durationMs: 0,
                      onAction: () => {
                        void onRevokeInvitation(invitation);
                      },
                    });
                  }}
                />
              </View>
            </GlassCard>
          ))}
        </View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 720,
    paddingHorizontal: 16,
    width: '100%',
  },
  loaderContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  invitationCard: {
    gap: 12,
  },
  pendingInvitationsList: {
    gap: 8,
  },
  pendingInvitationItem: {
    gap: 8,
  },
  pendingInvitationEmail: {
    flexShrink: 1,
  },
  pendingInvitationCode: {
    flexShrink: 1,
  },
  pendingInvitationActions: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
