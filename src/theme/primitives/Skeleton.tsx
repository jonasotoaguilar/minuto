import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/hooks';

export interface SkeletonProps {
  height?: number;
  radius?: number;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  width?: number | string;
}

export function Skeleton({ height, radius, style, width }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          backgroundColor: theme.surface.glass.soft,
          borderColor: theme.surface.glass.border,
          borderRadius: radius ?? 12,
          height: height ?? 18,
          opacity,
          width: (width ?? '100%') as number | `${number}%` | 'auto',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
