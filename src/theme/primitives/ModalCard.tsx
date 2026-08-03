import type { PropsWithChildren, ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/hooks';
import { PlainCard } from '@/theme/primitives/GlassCard';
import { SectionHeader } from '@/theme/primitives/SectionHeader';

export interface ModalCardProps extends PropsWithChildren {
  actions?: ReactNode;
  onDismiss: () => void;
  style?: ViewStyle;
  subtitle?: string;
  title?: string;
  visible: boolean;
}

export function ModalCard({
  actions,
  children,
  onDismiss,
  style,
  subtitle,
  title,
  visible,
}: ModalCardProps) {
  const theme = useTheme();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <View
        style={[styles.root, { backgroundColor: theme.overlay.modal }, style]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar modal"
          onPress={onDismiss}
          style={styles.backdrop}
        />

        <PlainCard style={styles.card}>
          {title ? <SectionHeader subtitle={subtitle} title={title} /> : null}

          {children}

          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </PlainCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    gap: 12,
    maxWidth: 520,
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
