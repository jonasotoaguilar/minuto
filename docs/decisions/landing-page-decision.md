# Decision: Keep an authentication-only public surface (no landing page)

**Status**: Approved (product owner decision, 2026-08-03)
**Related**: [issue #28](https://github.com/jonasotoaguilar/minuto/issues/28) (L08 LAND), audit finding F17 (product-decision portion), 2026-08-03 full application audit, 2026-08-03 parallel remediation plan (Section 6, lane L08)

## Decision

Minuto will NOT add a public landing page in this remediation. The public surface remains the existing authentication routes (login and register). No conditional application branch (`src/app/(public)/**`) and no new public route is authorized. The product owner selected "Mantener solo autenticación" (keep authentication only). Existing behavior is confirmed and documented, not changed.

## Context

- Audit finding F17 (MEDIUM, "Missing SEO surfaces"): no `robots.txt`, no true `sitemap.xml`, no canonical, OpenGraph, Twitter, or JSON-LD; `/_sitemap` is an HTML dev route. Only login and register are meaningfully public today. The finding asks to decide on a landing page and then scope SEO metadata to public routes.
- Product intent (PRD.md): Minuto is a mobile-first attendance tool for small businesses and PyMEs. No acquisition, marketing, or anonymous self-signup surface is defined; the roadmap keeps the product intentionally smaller than an HR/payroll suite. Product intent does not change with this decision.
- Current route structure: the root `src/app/index.tsx` unconditionally redirects to `/login`; the public surface is `src/app/(auth)/login` and `src/app/(auth)/register`; all product screens (`src/app/(tabs)/**`) sit behind authentication; `src/app/invite/[code]` is an authenticated join flow.

## Rationale

| Consideration | Assessment |
|---|---|
| PRD grounding | No landing page outcome, KPI, or user story exists; a landing page would be net-new scope without defined product value |
| Target users | Users arrive with an account, an invite, or a redirect from auth; no anonymous-visitor acquisition path is defined |
| Remediation focus | The audit verdict is NOT RELEASE-READY; this lane is decision-gated and should close scope, not open new surface |
| SEO intent | The indexing and share-preview intent behind F17 is served without a landing page: SEO metadata is scoped to the existing public auth routes (L07) |

## Consequences

- No `src/app/(public)/**` route group is created; the conditional implementation branch `feat/public-landing-page` is not triggered; L08 closes after this record.
- `PRD.md` is not edited: product intent is unchanged.
- `DESIGN.md` and `ARCHITECTURE.md` are not edited; no landing page design direction is developed or needed.
- No source code, route, or configuration changes; the app keeps redirecting unauthenticated visitors to `/login`.

## In-scope public routes (unchanged)

| Route | Role |
|---|---|
| `src/app/(auth)/login` | Public sign-in |
| `src/app/(auth)/register` | Public account creation |

All other routes require a session. The root `index` redirects to `/login`; `src/app/invite/[code]` is an authenticated join flow, not a marketing surface.

## Explicit non-goals

- No marketing, landing, or public home page for anonymous visitors.
- No feature teasers, pricing page, docs site, or self-signup funnel outside the register flow.
- No `src/app/(public)/**` group and no conditional application branch in this remediation.
- No SEO work in this lane (owned by L07).

## SEO handoff (L07)

L07 owns finding F17 (metadata portion) and F16: per-route Spanish titles and `lang`, `robots.txt`, `sitemap`, canonical, OpenGraph, and Twitter metadata, scoped to the public routes above (login/register today). L08 does not decide or build a landing page, and L07 must not introduce one.

## Conditions that would justify revisiting

- A defined acquisition goal in the PRD with outcomes and KPIs (for example, anonymous self-signup or a marketing funnel).
- Evidence of demand: organic traffic or unauthenticated link-preview needs beyond the auth routes.
- A product owner decision change, recorded as a new decision record that supersedes this one.

## Verification and rollback

- Verification: structural readback only: file exists, headings and links valid, decision unambiguous, exactly one file changed, authored lines within 50 to 100. Code tests are not applicable (N/A): documentation-only edit, no runtime or source change.
- Runtime checks: none apply; no routes, config, or source files changed.
- Rollback: revert this decision record. There is no application state to restore. If the decision is later reversed, a new decision record supersedes this one and any implementation is a separate PR scoped to new routes only, never touching auth or organization routes.
