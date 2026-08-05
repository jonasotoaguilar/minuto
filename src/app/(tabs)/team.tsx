import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { ExpelMemberDialog } from '@/components/team/expel-member-dialog';
import { EditMemberModal } from '@/components/team/team-edit-member-modal';
import {
  DEPARTMENT_FILTERS,
  filterTeamMembers,
  type TeamMember,
} from '@/components/team/team-member';
import { TeamMemberCard } from '@/components/team/team-member-card';
import { TeamMemberFilters } from '@/components/team/team-member-filters';
import { TeamMemberList } from '@/components/team/team-member-list';
import {
  normalizeTeamMemberRows,
  teamMemberRowsSchema,
} from '@/components/team/team-screen-data';
import { useEditMemberForm } from '@/components/team/use-edit-member-form';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/error';
import {
  type ExpelFlowState,
  getExpelFlowView,
  transitionExpelFlowState,
} from '@/lib/expel-flow-state';
import {
  deleteMembership,
  suspendMembership,
} from '@/lib/organization-invitations';
import { ROLE_PERMISSION_SUMMARIES } from '@/lib/role-permission-summaries';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/theme/feedback';
import {
  Chip,
  EmptyState,
  FeedbackBlock,
  GlassCard,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

const MANAGEMENT_ROLES: readonly string[] = ['owner', 'admin', 'manager'];
export default function TeamScreen() {
  const router = useRouter();
  const theme = useTheme();
  const feedback = useFeedback();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
  } = useOrganization();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    DEPARTMENT_FILTERS.all,
  );
  const [isApplyingMemberAction, setIsApplyingMemberAction] = useState(false);
  const [expelTarget, setExpelTarget] = useState<TeamMember | null>(null);
  const [expelFlowState, setExpelFlowState] = useState<ExpelFlowState>('idle');
  const expelFlowView = getExpelFlowView(expelFlowState);
  const canManageOrganization = MANAGEMENT_ROLES.includes(
    activeOrganization?.membershipRole ?? 'employee',
  );

  const loadMembers = useCallback(async () => {
    if (!activeOrganization) {
      return;
    }

    setIsLoadingMembers(true);
    setErrorMessage('');

    const { data, error } = await supabase.rpc(
      'get_organization_team_members',
      {
        p_organization_id: activeOrganization.id,
      },
    );

    if (error) {
      setErrorMessage(error.message);
      setMembers([]);
      setIsLoadingMembers(false);
      return;
    }

    const parsedRows = teamMemberRowsSchema.safeParse(data ?? []);

    if (!parsedRows.success) {
      setErrorMessage(
        'La lista de miembros llegó con un formato inválido. Recargá e intentá de nuevo.',
      );
      setMembers([]);
      setIsLoadingMembers(false);
      return;
    }

    setMembers(normalizeTeamMemberRows(parsedRows.data));
    setIsLoadingMembers(false);
  }, [activeOrganization]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const {
    editFormErrors,
    editFormMessage,
    editFormValues,
    isEditModalVisible,
    isHireDatePickerVisible,
    isSavingProfile,
    onCloseEditModal,
    onEditMember,
    onHireDateChange,
    onOpenHireDatePicker,
    onSaveMemberProfile,
    selectedMember,
    setEditFormValues,
    setIsHireDatePickerVisible,
  } = useEditMemberForm(loadMembers);

  const filteredMembers = useMemo(
    () => filterTeamMembers(members, searchQuery, selectedDepartment),
    [members, searchQuery, selectedDepartment],
  );

  const onSuspendMember = useCallback(
    async (membershipId: string) => {
      setIsApplyingMemberAction(true);

      try {
        await suspendMembership(membershipId);
        await loadMembers();
        feedback.show({
          tone: 'success',
          title: 'Miembro suspendido',
          message: 'El colaborador fue suspendido.',
        });
      } catch (error) {
        feedback.show({
          tone: 'error',
          title: 'Error',
          message:
            getErrorMessage(error) ?? 'No se pudo suspender al colaborador.',
        });
      } finally {
        setIsApplyingMemberAction(false);
      }
    },
    [feedback, loadMembers],
  );

  const onDeleteMember = useCallback(
    async (membershipId: string) => {
      setIsApplyingMemberAction(true);

      try {
        await deleteMembership(membershipId);
        await loadMembers();
        feedback.show({
          tone: 'success',
          title: 'Miembro eliminado',
          message: 'El colaborador fue eliminado permanentemente.',
        });
      } catch (error) {
        feedback.show({
          tone: 'error',
          title: 'Error',
          message:
            getErrorMessage(error) ?? 'No se pudo eliminar al colaborador.',
        });
      } finally {
        setIsApplyingMemberAction(false);
      }
    },
    [feedback, loadMembers],
  );

  const handleExpel = useCallback((member: TeamMember) => {
    setExpelTarget(member);
    setExpelFlowState((current) =>
      transitionExpelFlowState(current, 'open-choice'),
    );
  }, []);

  const handleCloseExpelActionModal = useCallback(() => {
    setExpelFlowState((current) => transitionExpelFlowState(current, 'close'));
  }, []);

  const handleSelectSuspend = useCallback(() => {
    setExpelFlowState((current) =>
      transitionExpelFlowState(current, 'select-suspend'),
    );
  }, []);

  const handleSelectDelete = useCallback(() => {
    setExpelFlowState((current) =>
      transitionExpelFlowState(current, 'select-delete'),
    );
  }, []);

  const handleCloseConfirmationModal = useCallback(() => {
    setExpelFlowState((current) => transitionExpelFlowState(current, 'close'));
  }, []);

  const handleConfirmExpelAction = useCallback(() => {
    if (!expelTarget) {
      return;
    }

    if (expelFlowState === 'confirm-suspend') {
      void onSuspendMember(expelTarget.id);
    }

    if (expelFlowState === 'confirm-delete') {
      void onDeleteMember(expelTarget.id);
    }

    setExpelFlowState((current) => transitionExpelFlowState(current, 'close'));
  }, [expelFlowState, expelTarget, onDeleteMember, onSuspendMember]);

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
    <Screen contentContainerStyle={styles.container}>
      <TeamMemberList
        canManageOrganization={canManageOrganization}
        contentContainerStyle={{
          paddingTop: theme.spacing.lg,
          paddingBottom: BottomTabInset + theme.spacing['2xl'],
        }}
        isApplyingMemberAction={isApplyingMemberAction}
        isLoadingMembers={isLoadingMembers}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <AppHeader />

            <GlassCard style={styles.organizationCard}>
              <SectionHeader
                eyebrow="Organización"
                title={activeOrganization.name}
              />

              <View style={styles.organizationMetaRow}>
                <Chip label={`${members.length} miembros`} tone="brand" />
              </View>

              {canManageOrganization ? (
                <View style={styles.organizationActions}>
                  <PrimaryButton
                    fullWidth={false}
                    label="Modificar organización"
                    onPress={() => router.push('/org-settings')}
                    style={styles.inlineAction}
                  />
                  <SecondaryButton
                    fullWidth={false}
                    label="Gestionar invitaciones"
                    onPress={() => router.push('/invitations')}
                    style={styles.inlineAction}
                  />
                </View>
              ) : null}
            </GlassCard>

            <TeamMemberFilters
              members={members}
              onDepartmentChange={setSelectedDepartment}
              onSearchChange={setSearchQuery}
              searchQuery={searchQuery}
              selectedDepartment={selectedDepartment}
            />

            {errorMessage ? (
              <FeedbackBlock tone="error" message={errorMessage} />
            ) : null}
          </View>
        }
        members={filteredMembers}
        onEditMember={onEditMember}
        onExpel={handleExpel}
      />

      {expelTarget ? (
        <ExpelMemberDialog
          expelFlowView={expelFlowView}
          isApplyingMemberAction={isApplyingMemberAction}
          onCloseChoice={handleCloseExpelActionModal}
          onCloseConfirmation={handleCloseConfirmationModal}
          onConfirm={handleConfirmExpelAction}
          onSelectDelete={handleSelectDelete}
          onSelectSuspend={handleSelectSuspend}
        />
      ) : null}

      <EditMemberModal
        activeOrganizationRole={
          activeOrganization?.membershipRole ?? 'employee'
        }
        editFormErrors={editFormErrors}
        editFormMessage={editFormMessage}
        editFormValues={editFormValues}
        isHireDatePickerVisible={isHireDatePickerVisible}
        isSavingProfile={isSavingProfile}
        onCloseEditModal={onCloseEditModal}
        onHireDateChange={onHireDateChange}
        onOpenHireDatePicker={onOpenHireDatePicker}
        onSaveMemberProfile={onSaveMemberProfile}
        selectedMember={selectedMember}
        setEditFormValues={setEditFormValues}
        setIsHireDatePickerVisible={setIsHireDatePickerVisible}
        visible={isEditModalVisible}
      />
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
  organizationCard: {
    gap: 16,
  },
  organizationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  organizationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineAction: {
    minWidth: 188,
  },
  listHeader: {
    gap: 16,
  },
});
