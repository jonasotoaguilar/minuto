# Contributing to Minuto

Minuto is an Expo + Supabase attendance app. Keep changes small, tested, and easy to review.

## Development Principles

- Prefer reviewable work units under ~400 changed lines.
- Keep product decisions in `PRD.md`.
- Keep system decisions in `ARCHITECTURE.md`.
- Keep UI decisions and token/component contracts in `DESIGN.md`.
- Before Supabase schema/RPC/RLS work, read the migration history in `supabase/migrations/`.
- Do not edit pushed migrations; create corrective migrations.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm run start
```

Required public environment variables:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN=
```

## Quality Commands

Use pnpm as the command runner unless a tool explicitly requires another CLI.

```bash
pnpm run lint
pnpm run typecheck
pnpm test
```

The repo uses pnpm; CI installs with `--frozen-lockfile`, so keep `pnpm-lock.yaml` in sync whenever dependencies change.

## Supabase Workflow

1. Read the migration history in `supabase/migrations/` before schema, RPC, RLS, or migration work.
2. Use Supabase CLI help instead of guessing commands:
   ```bash
   supabase --help
   supabase db --help
   ```
3. Start local Supabase before local database verification:
   ```bash
   supabase start
   supabase migration list --local
   ```
4. Add or update tests for RPC contract changes.
5. Run advisors where available before pushing schema changes.

Required hardening direction:

- `SECURITY DEFINER` functions should use `SET search_path = ''`.
- Fully qualify references inside RPCs, especially `RETURNS TABLE` functions.
- Keep authorization checks explicit for organization-scoped data.

## UI/UX Workflow

1. Check `DESIGN.md` before adding visual patterns.
2. Prefer existing primitives in `src/theme/primitives`.
3. If a pattern repeats twice, extract or plan a shared component.
4. Every user-facing data state should have loading, empty, error, and success handling.
5. Add accessibility labels for interactive controls, especially inputs used in E2E tests.

## Testing Strategy

| Layer          | Tool                               | Purpose                                        |
| -------------- | ---------------------------------- | ---------------------------------------------- |
| Unit / hooks   | Jest + RNTL                        | Business logic, hooks, screen behavior         |
| SQL contract   | Jest SQL-string or DB-backed tests | RPC/RLS regression coverage                    |
| E2E web        | Playwright                         | Auth and attendance critical paths on Expo web |
| Native Android | ADB/manual skill workflow          | Android-specific native behavior               |

Playwright should start web-first. Native Android E2E is a separate phase and should not be mixed into the first Playwright setup.

## Commit and PR Guidelines

- Use conventional commits, for example:
  - `docs: add product and architecture foundation`
  - `test: add attendance e2e coverage`
  - `fix: harden supabase rpc search paths`
- PRs should include:
  - summary of user-visible change;
  - tests run;
  - risk/rollback notes;
  - screenshots or recordings for UI changes.
- Avoid mixing unrelated areas in one PR, especially docs + Supabase migrations + UI refactors.

## Pre-commit Hooks

The repo uses Lefthook for git hooks, defined in `lefthook.yml` and installed automatically by `pnpm install` (prepare script):

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: pnpm run lint
    typecheck:
      run: pnpm run typecheck

pre-push:
  commands:
    test:
      run: pnpm test
```

Extend the hooks with test and staged-file optimizations as the suite grows.
