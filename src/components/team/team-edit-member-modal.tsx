import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { Dispatch, SetStateAction } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { HireDateField } from '@/components/team/hire-date-field';
import { MemberRoleSection } from '@/components/team/member-role-section';
import { WorkScheduleFields } from '@/components/team/work-schedule-fields';
import { useTheme } from '@/hooks/use-theme';
import {
  FeedbackBlock,
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  TextField,
  ThemedText,
} from '@/theme/primitives';

import {
  type EditEmployeeFormErrors,
  type EditEmployeeFormValues,
  getAllowedRolesForCaller,
} from './team-edit-form';
import type { MembershipRole, TeamMember } from './team-member';

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
  visible: boolean;
};

export function EditMemberModal({
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
  visible,
}: EditMemberModalProps) {
  const theme = useTheme();

  if (!selectedMember) {
    return null;
  }

  const isOwnerMember = selectedMember.role === 'owner';
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

          <WorkScheduleFields
            editFormErrors={editFormErrors}
            editFormValues={editFormValues}
            setEditFormValues={setEditFormValues}
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

const styles = StyleSheet.create({
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
});
