import type { Dispatch, PropsWithChildren, SetStateAction } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { WorkScheduleFields } from '@/components/team/work-schedule-fields';
import { useTheme } from '@/hooks/use-theme';
import {
  FeedbackBlock,
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  ThemedText,
} from '@/theme/primitives';

import type {
  EditEmployeeFormErrors,
  EditEmployeeFormValues,
} from './team-edit-form';
import type { TeamMember } from './team-member';

type EditMemberModalProps = PropsWithChildren<{
  editFormErrors: EditEmployeeFormErrors;
  editFormMessage: string;
  editFormValues: EditEmployeeFormValues;
  isSavingProfile: boolean;
  onCloseEditModal: () => void;
  onSaveMemberProfile: () => void;
  selectedMember: TeamMember | null;
  setEditFormValues: Dispatch<SetStateAction<EditEmployeeFormValues>>;
  visible: boolean;
}>;

export function EditMemberModal({
  children,
  editFormErrors,
  editFormMessage,
  editFormValues,
  isSavingProfile,
  onCloseEditModal,
  onSaveMemberProfile,
  selectedMember,
  setEditFormValues,
  visible,
}: EditMemberModalProps) {
  const theme = useTheme();

  if (!selectedMember) {
    return null;
  }

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

          {children}

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
