<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Fix expired-session local sign-out

- **Plan**: `context/changes/fix-expired-session-local-sign-out/plan.md`
- **Scope**: Phases 1–3
- **Date**: 2026-10-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations (all fixed)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Route test did not verify the real console boundary

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `__tests__/api/auth/session-expired.test.ts`
- **Detail**: The route test mocked `logAuthEvent`, so it verified safe logger arguments but not that the actual `console.error` boundary received no raw `Error`.
- **Fix**: Removed the logger mock and spied on `console.error` directly in the failure tests.
- **Decision**: FIXED

### F2 — Shared E2E helper weakened setup validation and retained duplicate URLs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `e2e/helpers/auth-session.ts`, `e2e/session-expiry.spec.ts`
- **Detail**: Signup no longer asserted the dashboard destination, and the session-expiry spec retained hard-coded localhost URLs instead of using `BASE_URL`.
- **Fix**: Restored the dashboard assertion inside `signUpNewUser()` and replaced the remaining localhost literals with `BASE_URL`.
- **Decision**: FIXED

### F3 — Cleanup could hang before redirecting

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `lib/auth/expired-session.ts`
- **Detail**: The route awaited client creation and provider cleanup without a deadline, so a hung provider request could block the login redirect.
- **Fix**: Added a named 5-second timeout around cleanup; timeout failures are logged as unexpected and the cleanup still resolves without rejecting.
- **Decision**: FIXED

### F4 — Focused regression command failed because coverage was always enabled

- **Severity**: ⚠️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/fix-expired-session-local-sign-out/plan.md`
- **Detail**: The focused regression tests passed, but the command exited non-zero because the focused subset could not satisfy repository-wide coverage thresholds.
- **Fix**: Updated the planned focused command to use `--coverage.enabled=false`; the full suite remains responsible for threshold validation.
- **Decision**: FIXED

## Verification

- `npm run test:run` — PASS, 261 tests
- `npm run test:coverage` — PASS, 261 tests; global coverage 96.59% statements / 93.9% branches; `lib/auth/**` thresholds met; new cleanup unit 100% statements and branches
- `npx vitest run --coverage.enabled=false __tests__/lib/auth/sign-out.test.ts __tests__/api/auth/logout.test.ts` — PASS, 10 tests
- `npx vitest run --coverage.enabled=false __tests__/lib/auth/expired-session.test.ts __tests__/api/auth/session-expired.test.ts` — PASS, 10 tests
- `npm run lint` — PASS
- `npx tsc --noEmit` — PASS
