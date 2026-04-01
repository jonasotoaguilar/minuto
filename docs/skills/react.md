# React Review Rules

Use this guide for `*.tsx` and `*.jsx`.

## Reject If

- A client component misses the required `"use client"` directive.
- `dangerouslySetInnerHTML` is used with untrusted or insufficiently justified content.
- Props are drilled through more than two intermediate layers without a strong reason.
- `useMemo` / `useCallback` are added by default instead of for a measured, documented need.
- Components mix data fetching, orchestration, rendering, and side effects into an unreviewable blob.
- Browser secrets or privileged config are embedded into client-side code.

## Require

- Clear separation between server and client responsibilities.
- Semantic HTML where possible (`section`, `nav`, `main`, `article`, `button`, `label`).
- Safe rendering of external/user content through normal JSX escaping or audited sanitization.
- Accessible naming and interaction patterns for controls.
- Minimal prop surfaces and descriptive prop names.

## Prefer

- Composition over inheritance.
- Colocated component files with nearby tests when the component is non-trivial.
- Derived UI state instead of duplicated state.
- Context or composition patterns over repeated prop tunneling.
- Event handlers and effects that are short and intention-revealing.

## Security Checks

- Treat URL params, storage, API responses, CMS content, and `postMessage` payloads as untrusted.
- Flag any raw HTML injection path or unsafe DOM manipulation.
- Flag `target="_blank"` links that omit `rel="noreferrer"` or `rel="noopener"` when relevant.
- Flag auth/token patterns that assume client-bundled values are secret.
