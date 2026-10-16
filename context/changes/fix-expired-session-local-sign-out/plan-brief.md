# Fix expired-session sign-out scope — Plan Brief

> Full plan: `context/changes/fix-expired-session-local-sign-out/plan.md`
> Research: `context/changes/fix-expired-session-local-sign-out/research.md`

## What & Why

`/api/auth/session-expired` signs the user out with global scope on an app-expired but provider-valid session, so one device's expiry (or anyone hitting the public GET) logs the user out everywhere. We switch it to local scope and fix its logging.

## Starting Point

The route calls `signOut()` inline and logs the raw error. `createLogout`/`signOutCurrentSession` already implement the local-scope, injected-dependency, safe-logging pattern for Log Out.

## Desired End State

Expiry cleanup ends only the current browser's session; other sessions stay valid, the redirect is unchanged, and failures are logged as code/status only. Unit coverage meets the 80 % / 90 % thresholds and an E2E proves isolation.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Structure | Extract `createExpiredSessionCleanup` in `lib/auth` | SOLID, injectable, testable; mirrors `createLogout` | Plan (overrides research "inline") |
| Log mapping | Promote `extractMeta` to `describeAuthError` in new `error-details.ts` | DRY; avoids the `@/lib/auth/log` mock in logout.test.ts | Plan review F1 |
| Log event | `EXPIRED_SESSION_LOG_EVENT` constants | Distinguish expiry from logout | Research |
| Reuse `signOutCurrentSession` | No | Its `getClaims()` re-check is wasted | Research |
| E2E | Direct route call, two contexts, new spec | Deterministic, fast | Research + Plan |
| E2E helpers | Extract to `e2e/helpers/auth-session.ts` | DRY with logout spec | Plan |
| Docs | One sentence in `docs/route-guard.md` | Guards against regression | Research |

## Scope

**In scope:** local scope, cleanup unit, safe logging, unit + E2E tests, docs sentence.

**Out of scope:** logout changes, POST/server-side expiry check, `session_extensions`, other raw-error logs, any UI (no Tailwind/a11y surface).

## Architecture / Approach

Route (parse, delegate, redirect) → `createExpiredSessionCleanup({ createClient, log })` → `signOut({ scope: "local" })`; errors mapped by `describeAuthError` and logged via `logAuthEvent`. Never throws.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared helper | `describeAuthError` (own module), event constants, tests | Behaviour drift in sign-out.ts |
| 2. Cleanup + route | Local-scope unit, thin route, full unit coverage | Missing a failure branch |
| 3. E2E + docs | Isolation spec, shared helpers, docs | E2E not runnable locally (CI only) |

**Prerequisites:** none. **Estimated effort:** ~1–2 sessions.

## Open Risks & Assumptions

- Route stays a public GET (forced-logout of the current browser remains; backlog).
- Refactor of `sign-out.ts` assumed safe because existing tests cover it.

## Success Criteria (Summary)

- A second session survives the expiry route.
- Coverage thresholds pass; no raw error objects logged.
