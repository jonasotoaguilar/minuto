# PRD: Minuto

> **Status**: Draft  
> **Last updated**: 2026-05-19  
> **Product**: Mobile attendance tracking for small businesses

Minuto helps small businesses and PyMEs record employee attendance, review attendance history, and understand worked hours without adopting a heavy HR/payroll system. The product must make the daily clock-in/clock-out flow fast for employees while giving owners and managers enough visibility to supervise teams and detect missing or open shifts.

## Quick Path

1. Optimize the daily attendance flow: validate location or remote work, clock in, clock out.
2. Give employees clear history and worked-hours summaries.
3. Give owners/managers secure organization and team management.
4. Keep the product intentionally smaller than a payroll or HR suite.

## Product Positioning

| Topic         | Decision                                                             |
| ------------- | -------------------------------------------------------------------- |
| Primary users | PyME owners/managers and employees                                   |
| Core problem  | Attendance tracking is often manual, inconsistent, and hard to audit |
| Outcome       | Reliable attendance records, history, and worked-hours reporting     |
| Primary KPI   | ≥95% of workdays have a completed attendance record                  |
| Secondary KPI | Clock-in/out task completed in <15 seconds after reaching the Control screen |

## 1. Executive Summary

- **Problem statement**: Small businesses need a lightweight way to record attendance, supervise teams, and review worked hours without spreadsheets or complex HR tools.
- **Proposed solution**: A mobile-first Expo app backed by Supabase that supports secure auth, organizations, memberships, clock-in/out, geolocation/remote validation, attendance history, and team management.
- **Success criteria**:
  - Employees can clock in or out in <15 seconds after reaching the Control screen.
  - Managers can review current team members and pending invitations without direct database access.
  - Attendance history loads with monthly grouping and summary totals for the selected period.
  - E2E coverage exists for auth and remote attendance critical paths.

## 2. Users and Jobs

### Personas

- **Owner/Admin**: creates an organization, invites members, reviews team attendance, and configures organization settings.
- **Manager**: supervises employees, reviews attendance history, and updates operational employee details when authorized.
- **Employee**: clocks in/out, sees shift state, and reviews personal attendance history.
- **Multi-organization user**: belongs to more than one organization and switches context safely.

### User Stories

- As an **employee**, I want to clock in and out from my phone so that my workday is recorded accurately.
- As a **remote employee**, I want to mark remote work so that I am not blocked by office geofencing.
- As a **manager**, I want to see attendance history and worked-hour totals so that I can review team operations.
- As an **owner/admin**, I want to invite, suspend, and manage members so that organization access stays controlled.
- As a **user in multiple organizations**, I want to switch organizations so that I can operate in the correct company context.

## 3. Acceptance Criteria

- [ ] Auth supports register, login, logout, and protected routes.
- [ ] Organization setup creates an owner membership and default office context.
- [ ] Attendance supports remote clock-in/out and office proximity validation.
- [ ] Attendance history shows grouped records and worked-hours summaries.
- [ ] Team management uses Supabase RPCs with role-aware authorization.
- [ ] UI states cover loading, empty, error, disabled, and success feedback consistently.
- [ ] Common UI primitives are documented in `DESIGN.md` and reused by screens.
- [ ] Supabase contracts are documented and covered by unit/contract/E2E tests.
- [ ] Playwright covers web critical paths; Android native checks are planned separately.

## 4. Non-Goals

- Payroll calculation, payslips, taxes, or legal payroll compliance.
- Vacation/PTO approval workflows.
- Push notifications.
- PDF/Excel export in the immediate correction phase.
- Offline-first sync or conflict resolution.
- Full HRIS features such as performance reviews or benefits.

## 5. Technical Scope

### Current Integration Points

- **Client**: Expo SDK 55, Expo Router, React Native, TypeScript.
- **Backend**: Supabase Auth, PostgreSQL, RLS, RPCs.
- **Validation**: Zod on client-side RPC wrappers where present.
- **Testing**: Jest/RNTL today; Playwright web E2E in place for auth critical paths, attendance E2E planned.

### Security and Privacy

Attendance data, profile data, organization membership, and location metadata are sensitive business data. All access must be scoped by organization membership and role. Client code must never use service-role credentials. RPCs must keep explicit authorization checks and hardened `SECURITY DEFINER` search paths.

## 6. Roadmap

| Phase              | Scope                                                                |
| ------------------ | -------------------------------------------------------------------- |
| Foundation         | PRD, architecture, design system docs, contribution workflow         |
| Quality Gate       | Lefthook, CI, lockfile/package consistency, baseline tests           |
| Supabase Hardening | RPC/RLS audit, local seed, local/remote consistency, advisors        |
| E2E                | Playwright web critical path; Android native E2E later               |
| UI/UX Unification  | Shared primitives, skeletons, modals, feedback, metrics              |
| Performance        | Decompose large screens/libs, reduce duplicated logic, bundle checks |

## 7. Open Questions

- Should production email confirmation be mandatory before organization access?
- Are hosted Supabase test projects allowed in CI, or must CI use local Supabase with Docker?
- Which reports are required first: employee monthly summary, manager team summary, or exportable report?
