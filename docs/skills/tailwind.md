# Tailwind and Styling Review Rules

Use this guide for CSS, SCSS, Tailwind config, and UI markup with utility classes.

## Reject If

- Utility strings are unreadable, duplicated everywhere, or encode entire design systems inline with no abstraction.
- Hardcoded colors, spacing, or z-index values bypass an existing token system without justification.
- Hover-only interactions hide required information or actions.
- Focus states are removed or visually imperceptible.
- Class composition creates contradictory or dead styles that make intent unclear.

## Require

- Reusable styling patterns for repeated UI primitives.
- Clear responsive intent (`sm:`, `md:`, `lg:`) instead of random one-off breakpoints.
- Visible focus, disabled, error, and loading states.
- Adequate contrast and legible text sizing.
- Layout decisions that avoid horizontal scrolling for common content widths.

## Prefer

- Variant helpers or extracted component wrappers for repeated class sets.
- Semantic tokens or Tailwind theme extensions over raw arbitrary values.
- Class groups ordered by purpose: layout → spacing → typography → color → state.
- Consistent spacing rhythm over pixel-by-pixel tweaking.

## Security Checks

- Do not hide security-relevant warnings, errors, or consent affordances behind interaction-only states.
- Treat user-provided class names or style fragments as untrusted input and avoid blindly interpolating them.