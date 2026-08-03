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
 * Web: 64px clears the floating bar on desktop; browsers without a bottom
 * safe-area inset get the same fixed value.
 */
const BOTTOM_TAB_INSETS: Record<string, number> = {
  ios: 50,
  android: 80,
  web: 64,
};

export const BottomTabInset = BOTTOM_TAB_INSETS[Platform.OS] ?? 64;

/**
 * Readable content width for web/tablet layouts. `Screen` applies it as the
 * default max width for centered content on web; callers can override it via
 * their own `contentContainerStyle` (later entries win).
 */
export const MaxContentWidth = 720;
