import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Font family names
// On native: these MUST match the keys passed to useFonts() in _layout.tsx.
// On web:    resolved via CSS custom properties declared in global.css.
// Fallbacks: system-serif for Lora, system-sans for Manrope, to ensure the
// app renders correctly when font assets fail to load.
// ---------------------------------------------------------------------------

const FONT_FAMILY = {
  /**
   * Lora — Display + Heading variants (serif, editorial feel).
   * Native key: "Lora_700Bold" / "Lora_600SemiBold" etc.
   * Web: resolved by --font-display CSS variable (Google Fonts import in CSS).
   */
  display: Platform.select({
    web: 'var(--font-display)',
    default: 'Lora_700Bold',
  }),
  heading: Platform.select({
    web: 'var(--font-display)',
    default: 'Lora_700Bold',
  }),
  headingMedium: Platform.select({
    web: 'var(--font-display)',
    default: 'Lora_500Medium',
  }),

  /**
   * Manrope — Body + UI text (geometric sans-serif, clean and readable).
   * Native key: "Manrope_400Regular" / "Manrope_600SemiBold" etc.
   * Web: resolved by --font-sans CSS variable (Google Fonts import in CSS).
   */
  body: Platform.select({
    web: 'var(--font-sans)',
    default: 'Manrope_400Regular',
  }),
  bodyMedium: Platform.select({
    web: 'var(--font-sans)',
    default: 'Manrope_500Medium',
  }),
  bodySemiBold: Platform.select({
    web: 'var(--font-sans)',
    default: 'Manrope_600SemiBold',
  }),
  bodyBold: Platform.select({
    web: 'var(--font-sans)',
    default: 'Manrope_700Bold',
  }),

  /**
   * Monospace — used in code snippets or technical UI (e.g., error codes).
   */
  mono: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    default: 'monospace',
    web: 'var(--font-mono)',
  }),
} as const;

// ---------------------------------------------------------------------------
// Typography scale
// Each variant pins the correct Manrope or Lora weight variant explicitly so
// that native can resolve the right asset without relying on font-weight
// synthesis (which React Native does not support for custom fonts).
// ---------------------------------------------------------------------------
export const TYPOGRAPHY_TOKENS = {
  display: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 40,
    fontWeight: '700' as const,
    lineHeight: 48,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 30,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  body: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  label: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  eyebrow: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 1.2,
  },
} as const;

export type TypographyTokens = typeof TYPOGRAPHY_TOKENS;
