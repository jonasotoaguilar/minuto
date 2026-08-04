import type { ReactNode } from 'react';
import {
  FlatList,
  type ListRenderItem,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { EmptyState, ThemedText } from '@/theme/primitives';
import type { TeamMember } from './team-member';
import { TeamMemberCard } from './team-member-card';

type TeamMemberListProps = {
  canManageOrganization: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  isApplyingMemberAction: boolean;
  isLoadingMembers: boolean;
  ListHeaderComponent?: ReactNode;
  members: TeamMember[];
  onEditMember: (member: TeamMember) => void;
  onExpel: (member: TeamMember) => void;
};

export function TeamMemberList({
  canManageOrganization,
  contentContainerStyle,
  isApplyingMemberAction,
  isLoadingMembers,
  ListHeaderComponent,
  members,
  onEditMember,
  onExpel,
}: TeamMemberListProps) {
  const renderItem: ListRenderItem<TeamMember> = ({ item }) => (
    <TeamMemberCard
      canManageOrganization={canManageOrganization}
      isApplyingMemberAction={isApplyingMemberAction}
      member={item}
      onEditMember={onEditMember}
      onExpel={onExpel}
    />
  );

  return (
    <FlatList
      contentContainerStyle={[styles.content, contentContainerStyle]}
      contentInsetAdjustmentBehavior="automatic"
      data={members}
      initialNumToRender={8}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(member) => member.id}
      ListEmptyComponent={
        isLoadingMembers ? null : (
          <EmptyState
            description="No hay miembros para ese filtro."
            title="Sin miembros"
          />
        )
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {ListHeaderComponent}
          {isLoadingMembers ? (
            <ThemedText colorToken="secondary" variant="body">
              Cargando miembros...
            </ThemedText>
          ) : null}
        </View>
      }
      maxToRenderPerBatch={10}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 16,
  },
  header: {
    gap: 16,
  },
});
