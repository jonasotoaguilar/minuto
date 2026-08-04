import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Chip,
  GlassCard,
  SecondaryButton,
  ThemedText,
} from '@/theme/primitives';

import { getRoleLabel, type TeamMember } from './team-member';

type TeamMemberCardProps = {
  canManageOrganization: boolean;
  isApplyingMemberAction: boolean;
  member: TeamMember;
  onEditMember: (member: TeamMember) => void;
  onExpel: (member: TeamMember) => void;
};

export function TeamMemberCard({
  canManageOrganization,
  isApplyingMemberAction,
  member,
  onEditMember,
  onExpel,
}: TeamMemberCardProps) {
  const canExpel = member.role !== 'owner';

  return (
    <GlassCard style={styles.memberCard} variant="soft">
      <View style={styles.memberTopRow}>
        <Avatar initials={member.initials} size="sm" />

        <View style={styles.memberChipsRow}>
          <Chip label={getRoleLabel(member.role)} tone="brand" />
        </View>
      </View>

      <View style={styles.memberCopy}>
        <ThemedText style={styles.memberName} variant="heading">
          {member.name}
        </ThemedText>
        <ThemedText colorToken="secondary" variant="subtitle">
          {member.roleLabel}
        </ThemedText>
        <ThemedText colorToken="secondary" variant="bodySmall">
          Departamento: {member.department}
        </ThemedText>
        <ThemedText colorToken="secondary" variant="bodySmall">
          Email: {member.email || 'Sin email'}
        </ThemedText>
        <ThemedText colorToken="secondary" variant="bodySmall">
          Teléfono: {member.phone || 'Sin teléfono'}
        </ThemedText>
      </View>

      {canManageOrganization ? (
        <View style={[styles.memberActions, styles.memberActionsRow]}>
          <SecondaryButton
            fullWidth={false}
            label="Editar"
            onPress={() => onEditMember(member)}
          />
          {canExpel ? (
            <SecondaryButton
              disabled={isApplyingMemberAction}
              fullWidth={false}
              label="Expulsar"
              onPress={() => onExpel(member)}
            />
          ) : null}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  memberCard: {
    gap: 12,
  },
  memberTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  memberChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberCopy: {
    gap: 4,
  },
  memberName: {
    letterSpacing: -0.4,
  },
  memberActions: {
    alignItems: 'flex-end',
  },
  memberActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
