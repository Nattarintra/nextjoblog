<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Fix expired-session sign-out scope

- **Plan**: context/changes/fix-expired-session-local-sign-out/plan.md
- **Mode**: Deep
- **Date**: 2026-10-16
- **Verdict**: REVISE
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding
6/6 paths ✓, 8/8 symbols ✓, brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — Phase 1 "pure import swap" breaks an existing test mock

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1, items 1–2 and criterion 1.2
- **Detail**: `__tests__/api/auth/logout.test.ts:16` mocks `@/lib/auth/log` as `{ logAuthEvent }` only. The logout route reaches `sign-out.ts` via `createLogout`, so a `describeAuthError` import from `log.ts` is undefined on the mock and vitest throws in failure-path tests. Criterion 1.2 only runs `sign-out.test.ts`, so it would not catch this.
- **Fix**: Put `describeAuthError` and `AuthLogDetails` in new `lib/auth/error-details.ts` (not `log.ts`); `log.ts` imports the type. Add `__tests__/api/auth/logout.test.ts` to criterion 1.2.
- **Decision**: FIXED (Fix in plan: describeAuthError moved to lib/auth/error-details.ts)

### F2 — E2E isolation check needs a helper the plan doesn't extract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3, items 1–2
- **Detail**: Getting B's access token needs `decodeAuthCookie`, private to `e2e/session-expiry.spec.ts:21`. The helper contract omits it, and the `/auth/v1/user` request also needs the `apikey` header.
- **Fix**: Add `decodeAuthCookie` to `e2e/helpers/auth-session.ts`, import it from both specs, and note the `apikey` header.
- **Decision**: FIXED (Fix in plan: decodeAuthCookie added to shared helper, apikey header noted)

### F3 — Plan exceeds change.md scope and touches logout code

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Overview, Phase 1 item 2, Phase 3 item 1
- **Detail**: change.md scopes the change to one argument, one unit test and an E2E check, and puts "any change to logout itself" out of scope. The plan edits `sign-out.ts` and `logout.spec.ts` and adds a new module. change.md also lacks the `priority: high` the research decided to record.
- **Fix A ⭐ Recommended**: Keep the plan; update change.md scope and add `priority: high`.
  - Strength: Plan and brief already justify it (mirrors createLogout, DRY).
  - Tradeoff: Two logout files touched; rerun logout unit and E2E suites.
  - Confidence: HIGH — refactors are mechanical once F1 is fixed.
  - Blind spot: logout.spec.ts cannot run locally; relies on CI.
- **Fix B**: Drop the `sign-out.ts` edit and `logout.spec.ts` extraction; duplicate the small helpers.
  - Strength: Zero logout surface touched.
  - Tradeoff: Duplication and loss of the DRY goal.
  - Confidence: MEDIUM — small duplication, but it would drift.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A: change.md scope widened, priority: high added)

### F4 — E2E can flake on the 30 s application lifetime

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3, new spec "Isolation"
- **Detail**: Playwright runs with `SESSION_TIMEBOX_MS=30000`. If B's app lifetime passes before `B.reload()`, requireSession sends B to the expiry route and signs it out, failing the test for an unrelated reason.
- **Fix**: Run setup, route call and checks back to back; assert the `/auth/v1/user` fetch (independent of app expiry) before `reload()`; note in the plan that the test is time-sensitive.
  - Strength: The server-side assertion stays deterministic on slow CI.
  - Tradeoff: The reload assertion still depends on timing.
  - Confidence: HIGH — token validity is independent of the application clock.
  - Blind spot: Exact CI margin not measured.
- **Decision**: FIXED (Fix in plan: token check first, time-sensitivity noted)

### F5 — Step 3.3 has no procedure

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 criterion 3.3
- **Detail**: "Fails against the unfixed route" cannot run locally on this macOS and the plan gives no procedure.
- **Fix**: Specify a throwaway CI commit reverting to `signOut()` expecting the isolation test to fail, or keep 2.6 (unit-level revert) as the proof and mark 3.3 optional.
- **Decision**: FIXED (Fix in plan: throwaway CI commit procedure added to 3.3)
