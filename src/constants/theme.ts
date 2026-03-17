/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1F14',
    textSecondary: '#51665B',
    background: '#ECF8F1',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#DFF2E8',
    border: '#D2E5D9',
    primary: '#11B981',
    primaryMuted: '#DFF6EB',
    accent: '#0E8E6D',
    surfaceMuted: '#F5FBF7',
    shadow: '#0B1F14',
  },
  dark: {
    text: '#F5F7F6',
    textSecondary: '#B8C4BC',
    background: '#0F1612',
    backgroundElement: '#18211C',
    backgroundSelected: '#1F2B24',
    border: '#223028',
    primary: '#12C187',
    primaryMuted: '#1B2C23',
    accent: '#0FA579',
    surfaceMuted: '#151E19',
    shadow: '#000000',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
