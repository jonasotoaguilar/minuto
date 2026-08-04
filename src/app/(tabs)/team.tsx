import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { z } from 'zod';

import { AppHeader } from '@/components/header-user-menu';
import { OrganizationSetupView } from '@/components/organization-setup-view';
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
  Avatar,
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
type AppTheme = ReturnType<typeof useTheme>;

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

interface EditEmployeeFormValues {
  breakDurationHours: string;
  department: string;
  hireDate: string;
  position: string;
  role: MembershipRole;
  shiftDurationHours: string;
  weeklyHours: string;
}

interface EditEmployeeFormErrors {
  breakDurationHours?: string;
  department?: string;
  hireDate?: string;
  position?: string;
  role?: string;
  shiftDurationHours?: string;
  weeklyHours?: string;
}

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

const DEFAULT_BREAK_DURATION_HOURS = 0.75;
const DEFAULT_SHIFT_DURATION_HOURS = 8;
const MANAGEMENT_ROLES: readonly string[] = ['owner', 'admin', 'manager'];
const MAX_BREAK_DURATION_HOURS = 5;
const MAX_SHIFT_DURATION_HOURS = 15;
const DEFAULT_WEEKLY_HOURS = 40;
const MAX_WEEKLY_HOURS = 100;
const TIME_INPUT_PATTERN = /^(\d{1,2}):(\d{2})$/;
const DATE_DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

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

  const departments = useMemo(() => {
    const uniqueDepartments = [
      ...new Set(members.map((member) => member.department)),
    ];
    return [DEPARTMENT_FILTERS.all, ...uniqueDepartments];
  }, [members]);

  const filteredMembers = useMemo(
    () => filterTeamMembers(members, searchQuery, selectedDepartment),
    [members, searchQuery, selectedDepartment],
  );

  const isEditModalVisible = selectedMember !== null;

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
      <AppHeader />

      <GlassCard style={styles.organizationCard}>
        <SectionHeader eyebrow="Organización" title={activeOrganization.name} />

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

      <GlassCard style={styles.filtersCard} variant="soft">
        <SectionHeader
          eyebrow="Explorar equipo"
          subtitle="Filtrá por nombre o departamento."
          title="Miembros"
        />

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          inputStyle={styles.searchInput}
          onChangeText={setSearchQuery}
          placeholder="Buscar miembros del equipo..."
          returnKeyType="search"
          value={searchQuery}
        />

        <ScrollView
          contentContainerStyle={styles.departmentsRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {departments.map((department) => {
            const isSelected = department === selectedDepartment;

            return (
              <Chip
                key={department}
                label={
                  department === DEPARTMENT_FILTERS.all
                    ? 'TODOS'
                    : department.toUpperCase()
                }
                onPress={() => setSelectedDepartment(department)}
                selected={isSelected}
                tone="brand"
              />
            );
          })}
        </ScrollView>
      </GlassCard>

      {errorMessage ? (
        <FeedbackBlock tone="error" message={errorMessage} />
      ) : null}

      {isLoadingMembers ? (
        <ThemedText colorToken="secondary" variant="body">
          Cargando miembros...
        </ThemedText>
      ) : null}

      {!isLoadingMembers && filteredMembers.length === 0 ? (
        <EmptyState
          description="No hay miembros para ese filtro."
          title="Sin miembros"
        />
      ) : null}

      {filteredMembers.map((member) => (
        <TeamMemberCard
          canManageOrganization={canManageOrganization}
          isApplyingMemberAction={isApplyingMemberAction}
          key={member.id}
          member={member}
          onDeleteMember={onDeleteMember}
          onEditMember={onEditMember}
          onSuspendMember={onSuspendMember}
          theme={theme}
        />
      ))}

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
        theme={theme}
        visible={isEditModalVisible}
      />
    </Screen>
  );
}

type TeamMemberCardProps = {
  canManageOrganization: boolean;
  isApplyingMemberAction: boolean;
  member: TeamMember;
  onDeleteMember: (membershipId: string) => Promise<void>;
  onEditMember: (member: TeamMember) => void;
  onSuspendMember: (membershipId: string) => Promise<void>;
  theme: AppTheme;
};

function TeamMemberCard({
  canManageOrganization,
  isApplyingMemberAction,
  member,
  onDeleteMember,
  onEditMember,
  onSuspendMember,
  theme,
}: TeamMemberCardProps) {
  const canExpel = member.role !== 'owner';
  const [expelFlowState, setExpelFlowState] = useState<ExpelFlowState>('idle');
  const expelFlowView = getExpelFlowView(expelFlowState);

  const handleExpel = useCallback(() => {
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
    if (expelFlowState === 'confirm-suspend') {
      void onSuspendMember(member.id);
    }

    if (expelFlowState === 'confirm-delete') {
      void onDeleteMember(member.id);
    }

    setExpelFlowState((current) => transitionExpelFlowState(current, 'close'));
  }, [expelFlowState, member.id, onDeleteMember, onSuspendMember]);

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
              onPress={handleExpel}
            />
          ) : null}
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={handleCloseExpelActionModal}
        transparent
        visible={expelFlowView.isChoiceVisible}
      >
        <View
          style={[styles.modalRoot, { backgroundColor: theme.overlay.scrim }]}
        >
          <Pressable
            onPress={handleCloseExpelActionModal}
            style={styles.modalBackdrop}
          />
          <GlassCard
            style={[
              styles.modalCard,
              { backgroundColor: theme.colors.background.card },
            ]}
            variant="soft"
          >
            <ThemedText variant="heading">
              Elegí cómo querés expulsar a este miembro
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText colorToken="secondary" variant="bodySmall">
                Desactiva el acceso y mantiene su historial.
              </ThemedText>
              <SecondaryButton
                disabled={isApplyingMemberAction}
                fullWidth={false}
                label="Despedir"
                onPress={handleSelectSuspend}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText colorToken="secondary" variant="bodySmall">
                Borra su membresía y el historial asociado.
              </ThemedText>
              <SecondaryButton
                disabled={isApplyingMemberAction}
                fullWidth={false}
                label="Eliminar"
                onPress={handleSelectDelete}
              />
            </View>
            <View style={styles.modalActions}>
              <SecondaryButton
                disabled={isApplyingMemberAction}
                label="Cancelar"
                onPress={handleCloseExpelActionModal}
                style={styles.modalActionButton}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={handleCloseConfirmationModal}
        transparent
        visible={expelFlowView.isConfirmationVisible}
      >
        <View
          style={[styles.modalRoot, { backgroundColor: theme.overlay.scrim }]}
        >
          <Pressable
            onPress={handleCloseConfirmationModal}
            style={styles.modalBackdrop}
          />
          <GlassCard
            style={[
              styles.modalCard,
              { backgroundColor: theme.colors.background.card },
            ]}
            variant="soft"
          >
            <ThemedText variant="heading">
              {expelFlowView.confirmation?.title ?? ''}
            </ThemedText>
            <ThemedText
              colorToken="secondary"
              style={styles.modalBody}
              variant="body"
            >
              {expelFlowView.confirmation?.body ?? ''}
            </ThemedText>
            <View style={styles.modalActions}>
              <SecondaryButton
                disabled={isApplyingMemberAction}
                label="Cancelar"
                onPress={handleCloseConfirmationModal}
                style={styles.modalActionButton}
              />
              <PrimaryButton
                disabled={isApplyingMemberAction}
                label="Confirmar"
                onPress={handleConfirmExpelAction}
                style={styles.modalActionButton}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </GlassCard>
  );
}

type EditMemberModalProps = {
  activeOrganizationRole: MembershipRole;
  editFormErrors: EditEmployeeFormErrors;
  editFormMessage: string;
  editFormValues: EditEmployeeFormValues;
  isHireDatePickerVisible: boolean;
  isSavingProfile: boolean;
  onCloseEditModal: () => void;
  onHireDateChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onOpenHireDatePicker: () => void;
  onSaveMemberProfile: () => void;
  selectedMember: TeamMember | null;
  setEditFormValues: Dispatch<SetStateAction<EditEmployeeFormValues>>;
  setIsHireDatePickerVisible: Dispatch<SetStateAction<boolean>>;
  theme: AppTheme;
  visible: boolean;
};

function EditMemberModal({
  activeOrganizationRole,
  editFormErrors,
  editFormMessage,
  editFormValues,
  isHireDatePickerVisible,
  isSavingProfile,
  onCloseEditModal,
  onHireDateChange,
  onOpenHireDatePicker,
  onSaveMemberProfile,
  selectedMember,
  setEditFormValues,
  setIsHireDatePickerVisible,
  theme,
  visible,
}: EditMemberModalProps) {
  if (!selectedMember) {
    return null;
  }

  const isOwnerMember = selectedMember?.role === 'owner';
  const allowedRoles = getAllowedRolesForCaller(
    activeOrganizationRole,
    selectedMember.role,
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCloseEditModal}
      transparent
      visible={visible}
    >
      <View
        style={[styles.modalRoot, { backgroundColor: theme.overlay.scrim }]}
      >
        <Pressable onPress={onCloseEditModal} style={styles.modalBackdrop} />

        <GlassCard
          style={[
            styles.modalCard,
            { backgroundColor: theme.colors.background.card },
          ]}
        >
          <SectionHeader
            eyebrow="Editar colaborador"
            subtitle={
              selectedMember?.name ?? 'Actualizá los datos del perfil laboral.'
            }
            title="Perfil del empleado"
          />

          <ThemedText
            colorToken="secondary"
            style={styles.modalBody}
            variant="bodySmall"
          >
            Ajustá la jornada, colación y datos del perfil laboral en una sola
            vista.
          </ThemedText>

          <TextField
            keyboardType="numbers-and-punctuation"
            label="Jornada laboral"
            onChangeText={(value) =>
              setEditFormValues((current) => ({
                ...current,
                shiftDurationHours: value,
              }))
            }
            onBlur={() =>
              setEditFormValues((current) => ({
                ...current,
                shiftDurationHours: formatTimeInputOnBlur(
                  current.shiftDurationHours,
                ),
              }))
            }
            errorMessage={editFormErrors.shiftDurationHours}
            helperText="Horas diarias del contrato, por ejemplo 08:00."
            placeholder="08:00"
            value={editFormValues.shiftDurationHours}
          />

          <TextField
            keyboardType="numbers-and-punctuation"
            label="Colación"
            onChangeText={(value) =>
              setEditFormValues((current) => ({
                ...current,
                breakDurationHours: value,
              }))
            }
            onBlur={() =>
              setEditFormValues((current) => ({
                ...current,
                breakDurationHours: formatTimeInputOnBlur(
                  current.breakDurationHours,
                ),
              }))
            }
            errorMessage={editFormErrors.breakDurationHours}
            helperText="Horas de colación del contrato, por ejemplo 00:45."
            placeholder="00:45"
            value={editFormValues.breakDurationHours}
          />

          <TextField
            keyboardType="numeric"
            label="Jornada semanal"
            onChangeText={(value) =>
              setEditFormValues((current) => ({
                ...current,
                weeklyHours: value,
              }))
            }
            errorMessage={editFormErrors.weeklyHours}
            helperText="Horas semanales del contrato, por ejemplo 40."
            placeholder="40"
            value={editFormValues.weeklyHours}
          />

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
            <View style={styles.fieldGroup}>
              <ThemedText variant="label">Rol (permisos)</ThemedText>
              <View style={styles.roleChipsRow}>
                {allowedRoles.map((roleOption) => (
                  <Chip
                    key={roleOption}
                    label={getRoleLabel(roleOption)}
                    onPress={() =>
                      setEditFormValues((current) => ({
                        ...current,
                        role: roleOption,
                      }))
                    }
                    selected={editFormValues.role === roleOption}
                    tone="brand"
                  />
                ))}
              </View>
              {editFormErrors.role ? (
                <ThemedText colorToken="error" variant="caption">
                  {editFormErrors.role}
                </ThemedText>
              ) : null}
              <ThemedText colorToken="secondary" variant="caption">
                Seleccioná el nivel de permisos del colaborador.
              </ThemedText>
              <ThemedText colorToken="secondary" variant="caption">
                {ROLE_PERMISSION_SUMMARIES[editFormValues.role].description}
              </ThemedText>
            </View>
          ) : null}

          {process.env.EXPO_OS === 'web' ? (
            <TextField
              label="Fecha de contratación"
              onChangeText={(value) =>
                setEditFormValues((current) => ({
                  ...current,
                  hireDate: value,
                }))
              }
              onBlur={() =>
                setEditFormValues((current) => ({
                  ...current,
                  hireDate: formatDateInputOnBlur(current.hireDate),
                }))
              }
              errorMessage={editFormErrors.hireDate}
              helperText="Formato DD/MM/YYYY, por ejemplo 15/01/2024."
              keyboardType="numbers-and-punctuation"
              placeholder="15/01/2024"
              value={editFormValues.hireDate}
            />
          ) : (
            <View style={styles.dateFieldWrapper}>
              <ThemedText variant="label">Fecha de contratación</ThemedText>

              <Pressable
                accessibilityHint="Abre el selector nativo de fecha"
                accessibilityLabel="Fecha de contratación"
                accessibilityRole="button"
                accessibilityState={{ expanded: isHireDatePickerVisible }}
                onPress={onOpenHireDatePicker}
                style={({ pressed }) => [
                  styles.dateFieldButton,
                  theme.elevation.card,
                  {
                    backgroundColor: theme.colors.background.card,
                    borderColor: editFormErrors.hireDate
                      ? theme.colors.status.error
                      : theme.colors.border.default,
                    borderRadius: theme.radius.lg,
                    minHeight: theme.spacing['4xl'] + theme.spacing.sm,
                    opacity: pressed ? 0.92 : 1,
                    paddingHorizontal: theme.spacing.lg,
                    shadowColor: theme.colors.shadow.color,
                  },
                ]}
              >
                <ThemedText
                  colorToken={editFormValues.hireDate ? 'primary' : 'secondary'}
                  variant="body"
                >
                  {editFormValues.hireDate || 'Seleccionar fecha'}
                </ThemedText>
                <ThemedText colorToken="secondary" variant="caption">
                  DD/MM/YYYY
                </ThemedText>
              </Pressable>

              <ThemedText
                colorToken={editFormErrors.hireDate ? 'error' : 'secondary'}
                variant="caption"
              >
                {editFormErrors.hireDate ||
                  'Selecciona la fecha de contratación.'}
              </ThemedText>

              {process.env.EXPO_OS === 'ios' && isHireDatePickerVisible ? (
                <View
                  style={[
                    styles.datePickerCard,
                    {
                      backgroundColor: theme.colors.background.card,
                      borderColor: theme.colors.border.default,
                      borderRadius: theme.radius.lg,
                    },
                  ]}
                >
                  <DateTimePicker
                    display="spinner"
                    maximumDate={getTodayPickerMaximumDate()}
                    mode="date"
                    onChange={onHireDateChange}
                    value={getDatePickerValue(editFormValues.hireDate)}
                  />
                  <View style={styles.dateFieldActions}>
                    <SecondaryButton
                      fullWidth={false}
                      label="Listo"
                      onPress={() => setIsHireDatePickerVisible(false)}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {editFormMessage ? (
            <FeedbackBlock message={editFormMessage} tone="error" />
          ) : null}

          <View style={styles.modalActions}>
            <PrimaryButton
              label="Guardar"
              loading={isSavingProfile}
              onPress={onSaveMemberProfile}
              style={styles.modalActionButton}
            />
            <SecondaryButton
              disabled={isSavingProfile}
              label="Cancelar"
              onPress={onCloseEditModal}
              style={styles.modalActionButton}
            />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

function getEmptyEditFormValues(): EditEmployeeFormValues {
  return {
    breakDurationHours: decimalToHHMM(DEFAULT_BREAK_DURATION_HOURS),
    department: '',
    hireDate: '',
    position: '',
    role: 'employee',
    shiftDurationHours: decimalToHHMM(DEFAULT_SHIFT_DURATION_HOURS),
    weeklyHours: String(DEFAULT_WEEKLY_HOURS),
  };
}

function createEditFormValues(member: TeamMember): EditEmployeeFormValues {
  return {
    breakDurationHours: decimalToHHMM(member.breakDurationHours),
    department:
      member.department === DEFAULT_DEPARTMENT ? '' : member.department,
    hireDate: formatDateForDisplay(member.hireDate),
    position: member.position,
    role: member.role,
    shiftDurationHours: decimalToHHMM(member.shiftDurationHours),
    weeklyHours: String(member.weeklyHours),
  };
}

function decimalToHHMM(decimal: number) {
  const totalMinutes = Math.max(0, Math.round(decimal * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function validateEditForm(values: EditEmployeeFormValues) {
  const errors: EditEmployeeFormErrors = {};
  const shiftDurationHours = parseHHMMInput(values.shiftDurationHours);
  const breakDurationHours = parseHHMMInput(values.breakDurationHours);
  const hireDate = normalizeDateForStorage(values.hireDate);
  const todayStorageDate = getTodayStorageDate();

  if (shiftDurationHours === null || shiftDurationHours <= 0) {
    errors.shiftDurationHours =
      'La jornada debe tener formato HH:MM y ser mayor a 00:00.';
  } else if (shiftDurationHours > MAX_SHIFT_DURATION_HOURS) {
    errors.shiftDurationHours =
      'La jornada laboral no puede superar las 15:00 horas.';
  }

  if (breakDurationHours === null) {
    errors.breakDurationHours = 'La colación debe tener formato HH:MM.';
  } else if (breakDurationHours < 0) {
    errors.breakDurationHours = 'La colación no puede ser negativa.';
  } else if (breakDurationHours > MAX_BREAK_DURATION_HOURS) {
    errors.breakDurationHours = 'La colación no puede superar las 05:00 horas.';
  } else if (
    shiftDurationHours !== null &&
    breakDurationHours >= shiftDurationHours
  ) {
    errors.breakDurationHours = 'La colación debe ser menor que la jornada.';
  }

  if (values.hireDate.trim().length > 0 && hireDate === null) {
    errors.hireDate = 'La fecha debe tener formato DD/MM/YYYY.';
  } else if (hireDate && hireDate > todayStorageDate) {
    errors.hireDate = 'La fecha de contratación no puede ser posterior a hoy.';
  }

  const weeklyHours = Number(values.weeklyHours);
  if (Number.isNaN(weeklyHours) || weeklyHours <= 0) {
    errors.weeklyHours = 'Las horas semanales deben ser mayor a 0.';
  } else if (weeklyHours > MAX_WEEKLY_HOURS) {
    errors.weeklyHours = `Las horas semanales no pueden superar ${MAX_WEEKLY_HOURS}.`;
  }

  if (
    errors.shiftDurationHours ||
    errors.breakDurationHours ||
    errors.hireDate ||
    errors.weeklyHours ||
    shiftDurationHours === null ||
    breakDurationHours === null
  ) {
    return {
      errors,
      isValid: false,
      parsed: null,
    } as const;
  }

  return {
    errors,
    isValid: true,
    parsed: {
      breakDurationHours,
      department: normalizeOptionalText(values.department),
      hireDate: hireDate || undefined,
      position: normalizeOptionalText(values.position),
      shiftDurationHours,
      weeklyHours,
    },
  } as const;
}

function parseHHMMInput(value: string) {
  const normalized = formatTimeInputOnBlur(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(TIME_INPUT_PATTERN);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes >= 60 ||
    hours < 0 ||
    hours > 24 ||
    (hours === 24 && minutes > 0)
  ) {
    return null;
  }

  return hours + minutes / 60;
}

function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isValidStorageDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}

function formatTimeInputOnBlur(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');

  if (/^\d{3,4}$/.test(digits) && !trimmed.includes(':')) {
    const padded = digits.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);

  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2].padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return trimmed;
}

function formatDateInputOnBlur(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 8 && !trimmed.includes('/')) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  }

  return trimmed;
}

function formatDateForStorageFromPicker(value: Date) {
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDatePickerValue(value: string) {
  const normalized = normalizeDateForStorage(value);

  if (!normalized) {
    return new Date();
  }

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getTodayPickerMaximumDate() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function getTodayStorageDate() {
  return formatDateForStorageFromPicker(new Date());
}

function formatDateForDisplay(value: string) {
  const normalized = value.trim();
  if (!normalized || !isValidStorageDateInput(normalized)) {
    return '';
  }

  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
}

function normalizeDateForStorage(value: string) {
  const normalized = formatDateInputOnBlur(value);
  if (!normalized) {
    return '';
  }

  const match = normalized.match(DATE_DISPLAY_PATTERN);
  if (!match) {
    return null;
  }

  const storageValue = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidStorageDateInput(storageValue) ? storageValue : null;
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
  filtersCard: {
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
  searchInput: {
    minHeight: 24,
  },
  departmentsRow: {
    gap: 8,
  },
  memberCard: {
    gap: 12,
  },
  memberTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  memberCopy: {
    gap: 4,
  },
  memberActions: {
    alignItems: 'flex-end',
  },
  memberActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberName: {
    letterSpacing: -0.4,
  },
  modalActionButton: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBody: {
    textAlign: 'left',
  },
  dateFieldActions: {
    alignItems: 'flex-start',
  },
  dateFieldButton: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateFieldWrapper: {
    gap: 8,
  },
  datePickerCard: {
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  modalCard: {
    gap: 12,
    maxWidth: 560,
    width: '100%',
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  memberChipsRow: {
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
