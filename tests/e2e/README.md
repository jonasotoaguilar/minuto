# Minuto E2E Tests

Playwright targets Expo Web first. Native Android E2E is a separate ADB-based workflow.

## Current scope

- Configure Playwright runner and shared helpers.
- Add accessibility labels before writing stable form/control selectors.
- Add `supabase/seed.sql` or a global setup before testing authenticated attendance flows.

## First suites to implement

1. `auth/`: register, login, validation errors, protected-route redirect.
2. `attendance/`: remote clock-in/out, active shift state, history preview.
3. `team/`: member list, invitation entry points, role-safe actions.

## Commands

```bash
pnpm run test:e2e:install
pnpm run test:e2e
pnpm run test:e2e:ui
```

Use `PLAYWRIGHT_BASE_URL` to point at an already-running Expo web server.
