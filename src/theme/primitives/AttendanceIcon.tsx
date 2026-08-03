import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/hooks';

const ATTENDANCE_ICON_SIZES = {
  md: 40,
  sm: 18,
} as const;

export type AttendanceIconSize = keyof typeof ATTENDANCE_ICON_SIZES;

export interface AttendanceIconProps {
  color?: string;
  direction: 'in' | 'out';
  size?: AttendanceIconSize;
}

export function AttendanceIcon({
  color,
  direction,
  size = 'md',
}: AttendanceIconProps) {
  const theme = useTheme();
  const isEntry = direction === 'in';
  const resolvedColor =
    color ??
    (isEntry ? theme.colors.status.success : theme.colors.status.error);
  const shellSize = ATTENDANCE_ICON_SIZES[size];
  const isCompact = size === 'sm';

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: isEntry
            ? theme.surface.glass.tint
            : theme.surface.glass.soft,
          borderColor: resolvedColor,
          height: shellSize,
          transform: [{ scaleX: isEntry ? -1 : 1 }],
          width: shellSize,
        },
      ]}
    >
      <View
        style={[
          isCompact
            ? styles.attendanceIconFrameVerticalCompact
            : styles.attendanceIconFrameVertical,
          { backgroundColor: resolvedColor },
        ]}
      />
      <View
        style={[
          isCompact
            ? styles.attendanceIconFrameHorizontalCompact
            : styles.attendanceIconFrameHorizontal,
          isCompact
            ? styles.attendanceIconFrameHorizontalTopCompact
            : styles.attendanceIconFrameHorizontalTop,
          { backgroundColor: resolvedColor },
        ]}
      />
      <View
        style={[
          isCompact
            ? styles.attendanceIconFrameHorizontalCompact
            : styles.attendanceIconFrameHorizontal,
          isCompact
            ? styles.attendanceIconFrameHorizontalBottomCompact
            : styles.attendanceIconFrameHorizontalBottom,
          { backgroundColor: resolvedColor },
        ]}
      />
      <View
        style={[
          isCompact
            ? styles.attendanceIconArrowShaftCompact
            : styles.attendanceIconArrowShaft,
          { backgroundColor: resolvedColor },
        ]}
      />
      <View
        style={[
          isCompact
            ? styles.attendanceIconArrowHeadCompact
            : styles.attendanceIconArrowHead,
          {
            borderLeftColor: 'transparent',
            borderRightColor: resolvedColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  attendanceIconFrameVertical: {
    borderRadius: 999,
    height: 16,
    left: 11,
    position: 'absolute',
    top: 12,
    width: 2,
  },
  attendanceIconFrameHorizontal: {
    borderRadius: 999,
    height: 2,
    left: 11,
    position: 'absolute',
    width: 10,
  },
  attendanceIconFrameHorizontalTop: {
    top: 12,
  },
  attendanceIconFrameHorizontalBottom: {
    bottom: 12,
  },
  attendanceIconArrowShaft: {
    borderRadius: 999,
    height: 2,
    left: 18,
    position: 'absolute',
    top: 19,
    width: 12,
  },
  attendanceIconArrowHead: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 5,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopColor: 'transparent',
    borderTopWidth: 5,
    left: 10,
    position: 'absolute',
    top: 14,
  },
  attendanceIconFrameVerticalCompact: {
    borderRadius: 999,
    height: 8,
    left: 5,
    position: 'absolute',
    top: 5,
    width: 1,
  },
  attendanceIconFrameHorizontalCompact: {
    borderRadius: 999,
    height: 1,
    left: 5,
    position: 'absolute',
    width: 5,
  },
  attendanceIconFrameHorizontalTopCompact: {
    top: 5,
  },
  attendanceIconFrameHorizontalBottomCompact: {
    bottom: 5,
  },
  attendanceIconArrowShaftCompact: {
    borderRadius: 999,
    height: 1,
    left: 8,
    position: 'absolute',
    top: 9,
    width: 5,
  },
  attendanceIconArrowHeadCompact: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopColor: 'transparent',
    borderTopWidth: 2,
    left: 4,
    position: 'absolute',
    top: 7,
  },
});
