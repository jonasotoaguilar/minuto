import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/hooks';
import { ThemedText } from '@/theme/primitives/ThemedText';

const AVATAR_SIZES = {
  sm: 54,
  md: 88,
  lg: 112,
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

export interface AvatarProps {
  accessibilityLabel?: string;
  initials: string;
  size?: AvatarSize;
  status?: 'online' | 'offline' | 'busy';
}

function resolveStatusColor(
  theme: ReturnType<typeof useTheme>,
  status: AvatarProps['status'],
) {
  switch (status) {
    case 'online':
      return theme.colors.status.success;
    case 'busy':
      return theme.colors.status.error;
    case 'offline':
    default:
      return theme.colors.text.muted;
  }
}

function resolveTextVariant(size: AvatarSize) {
  switch (size) {
    case 'lg':
      return 'heading';
    case 'md':
      return 'heading';
    case 'sm':
    default:
      return 'subtitle';
  }
}

export function Avatar({
  accessibilityLabel,
  initials,
  size = 'md',
  status,
}: AvatarProps) {
  const theme = useTheme();
  const dimension = AVATAR_SIZES[size];
  const statusSize = Math.max(10, Math.round(dimension * 0.16));
  const statusOffset = Math.max(4, Math.round(dimension * 0.07));

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? `Avatar de ${initials}`}
      style={[
        styles.root,
        {
          backgroundColor: theme.surface.glass.tint,
          borderColor: theme.surface.glass.border,
          borderRadius: 999,
          height: dimension,
          width: dimension,
        },
      ]}
    >
      <ThemedText colorToken="accent" variant={resolveTextVariant(size)}>
        {initials}
      </ThemedText>

      {status ? (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: resolveStatusColor(theme, status),
              borderColor: theme.colors.background.card,
              borderRadius: 999,
              borderWidth: 2,
              bottom: statusOffset,
              height: statusSize,
              position: 'absolute',
              right: statusOffset,
              width: statusSize,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
  },
});
