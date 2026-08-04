import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import {
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  ThemedText,
} from '@/theme/primitives';

type ExpelFlowView = {
  confirmation: { body: string; title: string } | null;
  isChoiceVisible: boolean;
  isConfirmationVisible: boolean;
};

type ExpelMemberDialogProps = {
  expelFlowView: ExpelFlowView;
  isApplyingMemberAction: boolean;
  onCloseChoice: () => void;
  onCloseConfirmation: () => void;
  onConfirm: () => void;
  onSelectDelete: () => void;
  onSelectSuspend: () => void;
};

export function ExpelMemberDialog({
  expelFlowView,
  isApplyingMemberAction,
  onCloseChoice,
  onCloseConfirmation,
  onConfirm,
  onSelectDelete,
  onSelectSuspend,
}: ExpelMemberDialogProps) {
  const theme = useTheme();

  return (
    <>
      <Modal
        animationType="fade"
        onRequestClose={onCloseChoice}
        transparent
        visible={expelFlowView.isChoiceVisible}
      >
        <View
          style={[styles.modalRoot, { backgroundColor: theme.overlay.scrim }]}
        >
          <Pressable onPress={onCloseChoice} style={styles.modalBackdrop} />
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
                onPress={onSelectSuspend}
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
                onPress={onSelectDelete}
              />
            </View>
            <View style={styles.modalActions}>
              <SecondaryButton
                disabled={isApplyingMemberAction}
                label="Cancelar"
                onPress={onCloseChoice}
                style={styles.modalActionButton}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={onCloseConfirmation}
        transparent
        visible={expelFlowView.isConfirmationVisible}
      >
        <View
          style={[styles.modalRoot, { backgroundColor: theme.overlay.scrim }]}
        >
          <Pressable
            onPress={onCloseConfirmation}
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
                onPress={onCloseConfirmation}
                style={styles.modalActionButton}
              />
              <PrimaryButton
                disabled={isApplyingMemberAction}
                label="Confirmar"
                onPress={onConfirm}
                style={styles.modalActionButton}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
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
  fieldGroup: {
    gap: 8,
  },
});
