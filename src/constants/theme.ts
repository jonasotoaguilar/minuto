/**
 * Platform layout constants used by tab and screen layouts.
 * Design tokens (colors, typography, spacing, surfaces) are accessed via
 * `useTheme()` from `@/hooks/use-theme` or imported directly from `@/theme`.
 */

import { Platform } from 'react-native';

/**
 * Extra bottom padding applied to scrollable tab screens so content is not
 * hidden behind the custom floating tab bar.
 * iOS: 50px matches the bar height + safe area.
 * Android: 80px accounts for the larger safe-area inset on most devices.
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
