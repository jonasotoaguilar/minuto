import { StyleSheet } from 'react-native';

import {
  ModalCard,
  PrimaryButton,
  SecondaryButton,
  ThemedText,
} from '@/theme/primitives';
import { formatTime } from './format';

export interface OvertimeActionsModalProps {
  currentTimezone: string;
  isSubmitting: boolean;
  onCloseAtStandardTime: () => void;
  onCloseWithCurrentTime: () => void;
  onDismiss: () => void;
  overtimeStandardCloseAt: Date | null;
  overtimeTitle: string;
  visible: boolean;
}

export function OvertimeActionsModal({
  currentTimezone,
  isSubmitting,
  onCloseAtStandardTime,
  onCloseWithCurrentTime,
  onDismiss,
  overtimeStandardCloseAt,
  overtimeTitle,
  visible,
}: OvertimeActionsModalProps) {
  return (
    <ModalCard
      visible={visible}
      onDismiss={onDismiss}
      title="Tu jornada habitual ya terminó"
      subtitle={overtimeTitle}
    >
      <ThemedText
        colorToken="secondary"
        style={styles.modalBody}
        variant="bodySmall"
      >
        Si te olvidaste de marcar la salida, podés cerrarla con la hora actual o
        con el horario habitual calculado.
      </ThemedText>

      <PrimaryButton
        label="Cerrar con hora actual"
        loading={isSubmitting}
        onPress={onCloseWithCurrentTime}
      />
      <SecondaryButton
        label={`Cerrar con jornada habitual (${overtimeStandardCloseAt ? formatTime(overtimeStandardCloseAt.toISOString(), currentTimezone) : '--:--'})`}
        loading={isSubmitting}
        onPress={onCloseAtStandardTime}
      />
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    textAlign: 'left',
  },
});
