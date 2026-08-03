---
version: alpha
name: Minuto Design System
description: Mobile-first attendance UI for PyMEs and small businesses
colors:
  primary: "#047857"
  text-primary: "#0B1F14"
  text-secondary: "#51665B"
  text-muted: "#5E7367"
  text-inverse: "#F5F7F6"
  background-screen: "#ECF8F1"
  background-card: "#FFFFFF"
  background-elevated: "#F5FBF7"
  background-selected: "#DFF2E8"
  border-default: "#D2E5D9"
  border-strong: "#A8C5B4"
  brand-primary: "#047857"
  brand-accent: "#0B775A"
  brand-muted: "#DFF6EB"
  status-success: "#11B981"
  status-warning: "#D97706"
  status-error: "#D14343"
typography:
  display:
    fontFamily: Lora
    fontSize: 40px
    fontWeight: "700"
    lineHeight: 48px
    letterSpacing: -0.6px
  heading:
    fontFamily: Lora
    fontSize: 30px
    fontWeight: "700"
    lineHeight: 38px
    letterSpacing: -0.4px
  title:
    fontFamily: Lora
    fontSize: 24px
    fontWeight: "700"
    lineHeight: 30px
    letterSpacing: -0.2px
  subtitle:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 24px
    letterSpacing: 0px
  body:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
    letterSpacing: 0px
  bodySmall:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
    letterSpacing: 0px
  caption:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 16px
    letterSpacing: 0.2px
  label:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: "600"
    lineHeight: 18px
    letterSpacing: 0.2px
  eyebrow:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: "700"
    lineHeight: 14px
    letterSpacing: 1.2px
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 999px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.pill}"
    padding: 20px
  button-secondary:
    backgroundColor: "{colors.background-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: 20px
  card-glass:
    backgroundColor: "{colors.background-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 20px
  text-field:
    backgroundColor: "{colors.background-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 16px
  screen:
    backgroundColor: "{colors.background-screen}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 24px
  feedback-error:
    backgroundColor: "{colors.background-card}"
    textColor: "{colors.status-error}"
    rounded: "{rounded.lg}"
    padding: 16px
  feedback-warning:
    backgroundColor: "{colors.status-warning}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 16px
---

## Overview

Minuto should feel calm, trustworthy, and operational. The product is used during time-sensitive work moments, so UI decisions must favor clarity, readable state, and fast task completion over decorative complexity. The current code already has a strong token foundation in `src/theme`; this document makes that foundation canonical and defines the correction path for inconsistent screens.

The primary UX principle is: **an employee should always know whether they are off shift, ready to clock in, actively working, or ready to clock out**.

## Colors

The current palette is green-led and business-friendly. Green is the primary brand/action color and should communicate attendance progress, safe confirmation, and productive state. Error and warning colors are reserved for actionable problems, not decoration.

Use these roles consistently:

- `brand-primary`: primary action, active state, success-forward confirmation.
- `brand-accent`: secondary emphasis, links, selected affordances.
- `background-screen`: app canvas.
- `background-card` / `background-elevated`: grouped content and cards.
- `background-selected`: selected chips, pressed secondary buttons, active filters.
- `status-error`: failed validation, blocked actions, destructive confirmations.
- `status-warning`: incomplete shifts, pending invitations, caution states.

### Contrast policy (light mode)

Light-mode text and interactive elements meet WCAG AA ≥ 4.5:1 on all common
surfaces. `brand-primary` is a deep emerald (`#047857`) so inverse text on the
primary CTA, links on white cards, and brand text on mint all clear AA;
`brand-accent` (`#0B775A`) and `text-muted` (`#5E7367`) are darkened
accordingly. `status-success` keeps the bright emerald (`#11B981`) reserved for
status dots and success indicators, which do not carry text contrast
requirements. Dark-mode values live in `src/theme/tokens/colors.ts` and are
unaffected by light-mode contrast changes. The automated proof is
`src/theme/__tests__/colors-contrast.test.ts`.

Known inconsistency to fix: splash/animated assets still use blue Expo-era colors while the product brand is green.

The YAML front matter records the light palette because the DESIGN.md lint schema supports a single canonical color map. Dark-mode values, overlay tokens, elevation tokens, and translucent surface tokens are part of the implementation source of truth in `src/theme/tokens/colors.ts`, `overlay.ts`, `elevation.ts`, and `surfaces.ts` until the design spec schema supports those token families directly.

## Typography

Minuto uses Lora for display/heading text and Manrope for body/UI text.

- Use Lora for screen titles, hero numbers, and high-level narrative moments.
- Use Manrope for labels, buttons, form fields, metrics, cards, and operational data.
- Avoid raw `Text` when `ThemedText` can express the same hierarchy.
- Prefer `label`, `body`, `bodySmall`, and `caption` before custom one-off font sizes.

## Layout

The product is mobile-first with web support through Expo web. Layout should use tokenized spacing from `src/theme/tokens/spacing.ts` and the `Screen` primitive.

Rules:

- Use `Screen` for safe area, scroll, keyboard avoidance, and background behavior.
- `Screen` centers content within `MaxContentWidth` (720) on web by default; screens pass their own `contentContainerStyle` `maxWidth` to override. Native renders uncapped.
- The web bottom tab inset is nonzero (`BottomTabInset` = 64 on web) so tab content clears the floating bar on desktop.
- Use bottom tab inset handling in one shared place, not repeated per tab screen.
- Replace magic numbers like `16`, `24`, `88`, and repeated `maxWidth` values with named tokens (`src/constants/theme.ts`) or documented component sizes.
- Every data screen needs loading, empty, error, and success states.

## Elevation & Depth

Cards should feel layered but not heavy. Current `GlassCard` and `PlainCard` patterns are the right base. Use depth to group operational tasks, not to create visual noise.

Implementation tokens:

- `elevation.card`: standard cards (`shadowOpacity: 0.08`, `shadowRadius: 24`, native elevation `4`).
- `elevation.elevated`: raised panels (`shadowOpacity: 0.12`, `shadowRadius: 32`, native elevation `8`).
- `elevation.modal`: blocking overlays (`shadowOpacity: 0.18`, `shadowRadius: 40`, native elevation `12`).
- `overlay.scrim` and `overlay.modal`: background dimming for temporary surfaces.
- `surface.glass`: translucent card backgrounds for `GlassCard`; the YAML `card-glass` entry is the stable component role, not a literal replacement for the translucent implementation.

- Use cards for attendance state, metrics, team member rows, and forms.
- Use modal depth only for blocking or focused decisions.
- Avoid repeated ad-hoc `Modal` + raw backdrop code; extract a `ModalCard` primitive.

## Shapes

The shape language is rounded and friendly:

- `pill`: primary and secondary buttons, chips, compact status badges.
- `xl`: hero cards and large grouped panels.
- `lg`: inputs, list rows, compact cards.
- `md`/`sm`: small nested UI only.

Do not introduce sharp-corner components unless the whole design system changes.

## Components

### Existing primitives to preserve

- `Screen`
- `ThemedText`
- `PrimaryButton` / `SecondaryButton`
- `TextField`
- `GlassCard` / `PlainCard`
- `Chip`
- `SectionHeader`
- `Skeleton` (loading placeholder)
- `ModalCard` (modal shell with backdrop and keyboard behavior)
- `FeedbackBlock` (success, warning, error, and info messaging)
- `EmptyState` (icon/title/body/action for empty data screens)
- `Avatar` (initials and member identity display)
- `MetricCard` (shared metric/value card)
- `AttendanceIcon` (shared attendance event icon)

### Missing primitives to create

- `Badge`: compact status pill replacement.

### Screen-specific UX corrections

- **Home**: replace duplicated formatters; add skeleton and empty states.
- **Control**: preserve the richer skeleton pattern; extract attendance panel, metrics, modal, and history preview.
- **Control History**: consolidate date/month navigation, event icons, and metric cards.
- **Team**: decompose the large screen into member list, invitations, filters, and edit flows.
- **Profile/Auth**: align fields with `TextField` and shared feedback patterns.

## Do's and Don'ts

- Do: document tokens before adding new visual values.
- Do: use `ThemedText` instead of raw `Text` for app UI.
- Do: add accessibility labels to interactive form fields and controls.
- Do: provide skeletons for data-loading screens, not only text like `Cargando...`.
- Do: keep each refactor reviewable under the 400-line budget.
- Don't: add new one-off card, modal, badge, metric, or formatter implementations.
- Don't: mix product copy, backend architecture, and UI token decisions in one file.
- Don't: rely on color alone for success/error/disabled states.
- Don't: use Playwright selectors that depend on visual text when an accessibility label is possible.
