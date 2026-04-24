import { StyleSheet, View } from 'react-native';
import { type InvitationScreenStatus } from '@/hooks/use-invitation-screen';
import type { PendingMembershipInvitation } from '@/lib/organization-invitations';
import {
  Chip,
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

interface InvitationScreenCardProps {
  activeInvitations: PendingMembershipInvitation[];
  errorMessage: string;
  invitationCode: string;
  onAccept: () => void;
  onContinue: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onSelectInvitation: (invitationId: string) => void;
  selectedInvitationId: string | null;
  status: InvitationScreenStatus;
}

export function InvitationScreenCard({
  activeInvitations,
  errorMessage,
  invitationCode,
  onAccept,
  onContinue,
  onLogin,
  onRegister,
  onSelectInvitation,
  selectedInvitationId,
  status,
}: InvitationScreenCardProps) {
  const isBusy = status === 'checking-session' || status === 'accepting';

  return (
    <GlassCard style={styles.card}>
      <SectionHeader
        eyebrow="Invitación"
        title="Unite a tu organización"
        subtitle="Validamos el código y tu sesión para activar el acceso de forma segura."
      />

      <View style={styles.codeBlock}>
        <ThemedText colorToken="secondary" variant="bodySmall">
          Código
        </ThemedText>
        <ThemedText variant="heading">{invitationCode || '—'}</ThemedText>
      </View>

      {isBusy ? (
        <ThemedText colorToken="secondary" variant="body">
          {status === 'checking-session'
            ? 'Validando sesión...'
            : 'Aceptando invitación...'}
        </ThemedText>
      ) : null}

      {status === 'ready-for-auth' ? (
        <View style={styles.actions}>
          <PrimaryButton label="Iniciar sesión" onPress={onLogin} />
          <SecondaryButton label="Crear cuenta" onPress={onRegister} />
        </View>
      ) : null}

      {status === 'ready' ? (
        <View style={styles.actions}>
          <ThemedText colorToken="secondary" variant="bodySmall">
            Seleccioná una invitación activa para continuar.
          </ThemedText>

          <View style={styles.roleChipsRow}>
            {activeInvitations.map((invitation) => (
              <Chip
                key={invitation.id}
                label={`${invitation.invitedEmail} · ${invitation.invitationCode}`}
                onPress={() => onSelectInvitation(invitation.id)}
                selected={selectedInvitationId === invitation.id}
                tone="brand"
              />
            ))}
          </View>

          <PrimaryButton label="Aceptar invitación" onPress={onAccept} />
        </View>
      ) : null}

      {status === 'accepted' ? (
        <View style={styles.actions}>
          <ThemedText colorToken="secondary" variant="bodySmall">
            Invitación aceptada. Ya podés entrar al equipo.
          </ThemedText>
          <PrimaryButton label="Ir al equipo" onPress={onContinue} />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.actions}>
          <ThemedText colorToken="error" variant="bodySmall">
            {errorMessage || 'No pudimos procesar la invitación.'}
          </ThemedText>
          <PrimaryButton label="Ir al equipo" onPress={onContinue} />
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    maxWidth: 560,
    width: '100%',
  },
  codeBlock: {
    gap: 4,
  },
  actions: {
    gap: 8,
  },
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
