<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Redirect unauthenticated users

- **Plan**: context/changes/redirect-unauthenticated-users/plan.md
- **Scope**: Phases 1–6; Phase 6.7 remains deferred
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 accepted observation

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING — E2E/build evidence remains environment-limited; 6.7 is deferred |

**Overall**: APPROVED. All actionable findings are resolved; F4 is accepted by user confirmation. Phase 6.7 remains explicitly deferred.

## Verification

- `npm run test:run`: PASS — 173 tests
- Coverage: PASS — 94.94% statements, 91.75% branches
- `npx tsc --noEmit`: PASS
- `npm run lint`: PASS
- `npm run build`: not verified; Google Fonts could not be fetched in the environment
- E2E: not run; Supabase status could not write telemetry under `/Users/natta/.supabase`

## Findings

### F1 — Deep-link E2E assertion cannot match the rendered 404 — RESOLVED

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Success Criteria
- **Location**: `e2e/route-guard.spec.ts:33`

The test expects a heading matching “can't find this page”, while `app/not-found.tsx:27` renders “We can't find this application”. The deep-link E2E test will fail after login.

**Resolution**: Updated the locator to match the implemented acceptance copy: `/can't find this application/i`.

### F2 — Fail-closed E2E test does not establish an authenticated session — RESOLVED

- **Severity**: WARNING
- **Impact**: HIGH
- **Dimension**: Success Criteria
- **Location**: `e2e/route-guard.spec.ts:47-55`

Each Playwright test receives a fresh browser context. This test adds only `e2e-session-check=fail`; it does not log in or restore auth cookies. The request will be redirected to `/login` for missing authentication before the test seam can produce `verification_failed`.

**Resolution**: Added login setup before setting `e2e-session-check=fail`, ensuring the test reaches the authenticated DAL path.

### F3 — Not-found screen includes explicitly deferred routes — RESOLVED

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Plan Adherence / Scope Discipline
- **Location**: `app/not-found.tsx:38-59`

The plan explicitly says to omit “View All Applications” until `/applications` exists. The implementation adds links to `/applications`, `/calendar`, and `/analytics`, none of which exist. This creates scope drift and dead-end navigation.

**Resolution**: Removed the unavailable applications, calendar, and analytics navigation from the not-found screen and updated its test to cover the planned Dashboard recovery actions.

### F4 — Manual verification is marked complete without repository evidence — ACCEPTED

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Success Criteria

The plan marks 6.4–6.6 complete, but no reproducible deployment or manual-test evidence is recorded in the repository. The user confirmed that 6.4–6.6 are complete. Item 6.7 remains explicitly deferred and unverified.

**Disposition**: Accepted; no code change required.

### F5 — Retry status is announced before retry completion — RESOLVED

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `app/(protected)/_components/SessionCheckFailed.tsx:21-27`

"Still unable to verify your session" was set immediately when retry began, before the refresh result was known. This could briefly announce failure even when retry succeeded.

**Resolution**: The live region now derives "Checking your session" while pending and the failure message after the transition settles while this screen remains mounted, without an effect-driven state update.

## Triage Status

- F1: Resolved by updating `e2e/route-guard.spec.ts:33`.
- F2: Resolved by authenticating the test page before setting the failure seam.
- F3: Resolved by removing unavailable navigation from `app/not-found.tsx` and updating its test.
- F4: Accepted based on user confirmation that 6.4–6.6 are complete; 6.7 remains deferred.
- F5: Resolved by separating pending and failed retry announcements.
