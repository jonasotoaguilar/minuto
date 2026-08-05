import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { ExpelMemberDialog } from '@/components/team/expel-member-dialog';
import { HireDateField } from '@/components/team/hire-date-field';
import { MemberRoleSection } from '@/components/team/member-role-section';
import {
  decimalToHHMM,
  formatDateForDisplay,
  formatDateForStorageFromPicker,
  formatDateInputOnBlur,
  formatTimeInputOnBlur,
  getDatePickerValue,
  getTodayPickerMaximumDate,
  getTodayStorageDate,
  normalizeDateForStorage,
  normalizeOptionalText,
  parseHHMMInput,
} from '@/components/team/team-date-time-format';
import {
  createEditFormValues,
  DEFAULT_BREAK_DURATION_HOURS,
  DEFAULT_SHIFT_DURATION_HOURS,
  DEFAULT_WEEKLY_HOURS,
  type EditEmployeeFormErrors,
  type EditEmployeeFormValues,
  getEmptyEditFormValues,
  MAX_BREAK_DURATION_HOURS,
  MAX_SHIFT_DURATION_HOURS,
  MAX_WEEKLY_HOURS,
  validateEditForm,
} from '@/components/team/team-edit-form';
import { EditMemberModal } from '@/components/team/team-edit-member-modal';
import {
  DEFAULT_DEPARTMENT,
  DEPARTMENT_FILTERS,
  deriveInitials,
  deriveName,
  filterTeamMembers,
  getRoleLabel,
  mapMembershipRole,
  normalizeDepartment,
  type TeamMember,
} from '@/components/team/team-member';
import { TeamMemberCard } from '@/components/team/team-member-card';
import { TeamMemberFilters } from '@/components/team/team-member-filters';
import { TeamMemberList } from '@/components/team/team-member-list';
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
import {
  Chip,
  EmptyState,
  FeedbackBlock,
  GlassCard,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  TextField,
  ThemedText,
} from '@/theme/primitives';

const MEMBERSHIP_ROLES = ['owner', 'admin', 'manager', 'employee'] as const;
const MEMBERSHIP_STATUSES = ['invited', 'active', 'suspended'] as const;

type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

const teamMemberRowSchema = z.object({
  id: z.string().min(1),
  organization_id: z.string().min(1),
  user_id: z.string().nullable(),
  invited_email: z.string().nullable(),
  role: z.enum(MEMBERSHIP_ROLES),
  status: z.enum(MEMBERSHIP_STATUSES),
  member_position: z.string().nullable(),
  department: z.string().nullable(),
  hire_date: z.string().nullable(),
  shift_duration_hours: z.number().nullable(),
  break_duration_hours: z.number().nullable(),
  weekly_hours: z.number().nullable(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

const teamMemberRowsSchema = z.array(teamMemberRowSchema);

const roleUpdateResponseSchema = z.object({
  success: z.boolean().optional(),
  error_code: z.string().optional(),
});

interface UpdateEmployeeProfileParams {
  membershipId: string;
  breakDurationHours?: number;
  department?: string;
  hireDate?: string;
  position?: string;
  shiftDurationHours?: number;
  weeklyHours?: number;
}

interface UpdateEmployeeProfileResult {
  errorCode?: string;
  success: boolean;
}

type UpdateEmployeeProfileFn = (
  params: UpdateEmployeeProfileParams,
) => Promise<UpdateEmployeeProfileResult>;

const MANAGEMENT_ROLES: readonly string[] = ['owner', 'admin', 'manager'];
export default function TeamScreen() {
  const router = useRouter();
  const theme = useTheme();
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
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editFormValues, setEditFormValues] = useState<EditEmployeeFormValues>(
    getEmptyEditFormValues(),
  );
  const [editFormErrors, setEditFormErrors] = useState<EditEmployeeFormErrors>(
    {},
  );
  const [editFormMessage, setEditFormMessage] = useState('');
  const [isHireDatePickerVisible, setIsHireDatePickerVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
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

    const normalizedMembers = parsedRows.data.map((row) => {
      const name = deriveName(
        row.full_name ?? undefined,
        row.invited_email,
        row.user_id,
        row.id,
      );

      return {
        breakDurationHours:
          row.break_duration_hours ?? DEFAULT_BREAK_DURATION_HOURS,
        department: normalizeDepartment(row.department),
        hireDate: row.hire_date?.trim() ?? '',
        email: row.email?.trim() ?? '',
        id: row.id,
        initials: deriveInitials(name),
        name,
        phone: row.phone?.trim() ?? '',
        position: row.member_position?.trim() ?? '',
        role: row.role,
        roleLabel: row.member_position?.trim() || mapMembershipRole(row.role),
        shiftDurationHours:
          row.shift_duration_hours ?? DEFAULT_SHIFT_DURATION_HOURS,
        weeklyHours: row.weekly_hours ?? DEFAULT_WEEKLY_HOURS,
      } satisfies TeamMember;
    });

    setMembers(normalizedMembers);
    setIsLoadingMembers(false);
  }, [activeOrganization]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(
    () => filterTeamMembers(members, searchQuery, selectedDepartment),
    [members, searchQuery, selectedDepartment],
  );

  const isEditModalVisible = selectedMember !== null;
  const isOwnerMember = selectedMember?.role === 'owner';
  const allowedRoles = getAllowedRolesForCaller(
    activeOrganization?.membershipRole ?? 'employee',
    selectedMember?.role ?? 'employee',
  );

  const onEditMember = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setEditFormValues(createEditFormValues(member));
    setEditFormErrors({});
    setEditFormMessage('');
    setIsHireDatePickerVisible(false);
  }, []);

  const onCloseEditModal = useCallback(() => {
    if (isSavingProfile) {
      return;
    }

    setSelectedMember(null);
    setEditFormValues(getEmptyEditFormValues());
    setEditFormErrors({});
    setEditFormMessage('');
    setIsHireDatePickerVisible(false);
  }, [isSavingProfile]);

  const applyHireDateSelection = useCallback((date: Date) => {
    const storageValue = formatDateForStorageFromPicker(date);

    setEditFormValues((current) => ({
      ...current,
      hireDate: formatDateForDisplay(storageValue),
    }));
    setEditFormErrors((current) => ({
      ...current,
      hireDate: undefined,
    }));
  }, []);

  const onHireDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (process.env.EXPO_OS === 'android') {
        setIsHireDatePickerVisible(false);
      }

      if (event.type === 'dismissed' || !selectedDate) {
        return;
      }

      applyHireDateSelection(selectedDate);
    },
    [applyHireDateSelection],
  );

  const onOpenHireDatePicker = useCallback(() => {
    const pickerValue = getDatePickerValue(editFormValues.hireDate);

    if (process.env.EXPO_OS === 'android') {
      DateTimePickerAndroid.open({
        maximumDate: getTodayPickerMaximumDate(),
        mode: 'date',
        onChange: onHireDateChange,
        value: pickerValue,
      });
      return;
    }

    if (process.env.EXPO_OS !== 'ios') {
      return;
    }

    setIsHireDatePickerVisible(true);
  }, [editFormValues.hireDate, onHireDateChange]);

  const onSaveMemberProfile = useCallback(async () => {
    if (!selectedMember) {
      return;
    }

    const validation = validateEditForm(editFormValues);
    setEditFormErrors(validation.errors);

    if (!validation.isValid) {
      setEditFormMessage('Revisá los campos marcados antes de guardar.');
      return;
    }

    setIsSavingProfile(true);
    setEditFormMessage('');

    try {
      const attendanceModule = (await import(
        '@/lib/attendance'
      )) as typeof import('@/lib/attendance') & {
        updateEmployeeProfile?: UpdateEmployeeProfileFn;
      };

      if (typeof attendanceModule.updateEmployeeProfile !== 'function') {
        throw new Error(
          'La actualización del perfil todavía no está disponible.',
        );
      }

      const result = await attendanceModule.updateEmployeeProfile({
        membershipId: selectedMember.id,
        shiftDurationHours: validation.parsed.shiftDurationHours,
        breakDurationHours: validation.parsed.breakDurationHours,
        weeklyHours: validation.parsed.weeklyHours,
        position: validation.parsed.position,
        department: validation.parsed.department,
        hireDate: validation.parsed.hireDate,
      });

      if (!result.success) {
        throw new Error(mapProfileUpdateError(result.errorCode));
      }

      if (editFormValues.role !== selectedMember.role) {
        const { data: roleData, error: roleError } = await supabase.rpc(
          'update_membership_role',
          {
            p_membership_id: selectedMember.id,
            p_new_role: editFormValues.role,
          },
        );

        if (roleError) {
          throw new Error(
            `No se pudo actualizar el rol del colaborador (${roleError.message}).`,
          );
        }

        const parsedRoleResult = roleUpdateResponseSchema.safeParse(roleData);

        if (!parsedRoleResult.success) {
          throw new Error(
            'La actualización del rol devolvió un formato inválido.',
          );
        }

        const roleResult = parsedRoleResult.data;
        if (!roleResult?.success) {
          throw new Error(mapRoleUpdateError(roleResult?.error_code));
        }
      }

      await loadMembers();
      setSelectedMember(null);
      setEditFormValues(getEmptyEditFormValues());
      setEditFormErrors({});
      setEditFormMessage('');
      setIsHireDatePickerVisible(false);
      Alert.alert(
        'Perfil actualizado',
        'Los datos del colaborador fueron guardados.',
      );
    } catch (error) {
      setEditFormMessage(
        getErrorMessage(error) ??
          'No se pudo guardar el perfil del colaborador.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  }, [editFormValues, loadMembers, selectedMember]);

  const onSuspendMember = useCallback(
    async (membershipId: string) => {
      setIsApplyingMemberAction(true);

      try {
        await suspendMembership(membershipId);
        await loadMembers();
        Alert.alert('Miembro suspendido', 'El colaborador fue suspendido.');
      } catch (error) {
        Alert.alert(
          'Error',
          getErrorMessage(error) ?? 'No se pudo suspender al colaborador.',
        );
      } finally {
        setIsApplyingMemberAction(false);
      }
    },
    [loadMembers],
  );

  const onDeleteMember = useCallback(
    async (membershipId: string) => {
      setIsApplyingMemberAction(true);

      try {
        await deleteMembership(membershipId);
        await loadMembers();
        Alert.alert(
          'Miembro eliminado',
          'El colaborador fue eliminado permanentemente.',
        );
      } catch (error) {
        Alert.alert(
          'Error',
          getErrorMessage(error) ?? 'No se pudo eliminar al colaborador.',
        );
      } finally {
        setIsApplyingMemberAction(false);
      }
    },
    [loadMembers],
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
        editFormErrors={editFormErrors}
        editFormMessage={editFormMessage}
        editFormValues={editFormValues}
        isSavingProfile={isSavingProfile}
        onCloseEditModal={onCloseEditModal}
        onSaveMemberProfile={onSaveMemberProfile}
        selectedMember={selectedMember}
        setEditFormValues={setEditFormValues}
        visible={isEditModalVisible}
      >
        {!isOwnerMember ? (
          <>
            <TextField
              label="Cargo"
              onChangeText={(value) =>
                setEditFormValues((current) => ({
                  ...current,
                  position: value,
                }))
              }
              placeholder="Ej: Supervisor de turno"
              value={editFormValues.position}
            />

            <TextField
              label="Departamento"
              onChangeText={(value) =>
                setEditFormValues((current) => ({
                  ...current,
                  department: value,
                }))
              }
              placeholder="Ej: Operaciones"
              value={editFormValues.department}
            />
          </>
        ) : null}

        {!isOwnerMember && allowedRoles.length > 0 ? (
          <MemberRoleSection
            allowedRoles={allowedRoles}
            editFormErrors={editFormErrors}
            editFormValues={editFormValues}
            setEditFormValues={setEditFormValues}
          />
        ) : null}

        <HireDateField
          editFormErrors={editFormErrors}
          editFormValues={editFormValues}
          isHireDatePickerVisible={isHireDatePickerVisible}
          onHireDateChange={onHireDateChange}
          onOpenHireDatePicker={onOpenHireDatePicker}
          setEditFormValues={setEditFormValues}
          setIsHireDatePickerVisible={setIsHireDatePickerVisible}
        />
      </EditMemberModal>
    </Screen>
  );
}

function mapProfileUpdateError(errorCode?: string) {
  switch (errorCode) {
    case 'MEMBERSHIP_NOT_FOUND':
      return 'No encontramos al colaborador que querés actualizar.';
    case 'INVALID_SHIFT':
      return 'La jornada informada no es válida.';
    case 'INVALID_BREAK':
      return 'La colación informada no es válida.';
    default:
      return 'No se pudo guardar el perfil del colaborador.';
  }
}

function getAllowedRolesForCaller(
  callerRole: MembershipRole,
  targetRole: MembershipRole,
): MembershipRole[] {
  if (targetRole === 'owner') return [];
  if (callerRole === 'owner') return ['admin', 'manager', 'employee'];
  if (callerRole === 'admin' && targetRole !== 'admin')
    return ['manager', 'employee'];
  return [];
}

function mapRoleUpdateError(errorCode?: string) {
  switch (errorCode) {
    case 'MEMBERSHIP_NOT_FOUND':
      return 'No encontramos al colaborador.';
    case 'CANNOT_CHANGE_OWN_ROLE':
      return 'No podés cambiar tu propio rol.';
    case 'CANNOT_CHANGE_OWNER_ROLE':
      return 'El rol de owner no puede modificarse.';
    case 'UNAUTHORIZED':
      return 'No tenés permisos para asignar ese rol.';
    case 'INVALID_ROLE':
      return 'El rol seleccionado no es válido.';
    default:
      return 'No se pudo actualizar el rol del colaborador.';
  }
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
  invitationCard: {
    gap: 12,
  },
  pendingInvitationsList: {
    gap: 8,
  },
  pendingInvitationItem: {
    gap: 8,
  },
  pendingInvitationTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  pendingInvitationEmailWrap: {
    flex: 1,
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
});
