import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { InvitationScreenCard } from '@/components/invitation-screen-card';
import { useInvitationScreen } from '@/hooks/use-invitation-screen';
import { useTheme } from '@/hooks/use-theme';
import { Screen } from '@/theme/primitives';

export default function InvitationCodeScreen() {
  const theme = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const invitation = useInvitationScreen(code ?? '');

  useEffect(() => {
    if (invitation.status !== 'accepted') {
      return undefined;
    }

    const timeout = setTimeout(() => {
      invitation.goToTeam();
    }, 900);

    return () => clearTimeout(timeout);
  }, [invitation.goToTeam, invitation.status]);

  return (
    <Screen
      contentContainerStyle={[
        styles.container,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing['3xl'],
        },
      ]}
    >
      <View style={styles.centered}>
        <InvitationScreenCard
          activeInvitations={invitation.activeInvitations}
          errorMessage={invitation.errorMessage}
          invitationCode={invitation.invitationCode}
          onAccept={() => {
            void invitation.acceptSelectedInvitation();
          }}
          onContinue={invitation.goToTeam}
          onLogin={invitation.goToLogin}
          onRegister={invitation.goToRegister}
          onSelectInvitation={invitation.selectInvitation}
          selectedInvitationId={invitation.selectedInvitation?.id ?? null}
          status={invitation.status}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
