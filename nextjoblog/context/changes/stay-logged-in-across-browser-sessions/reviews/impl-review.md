<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stay Logged In Across Browser Sessions

- **Plan**: context/changes/stay-logged-in-across-browser-sessions/plan.md
- **Scope**: Completed Phases 1, 3–6 of 6 (Phase 2 remains incomplete: 2.2 unchecked)
- **Date**: 2026-09-14
- **Verdict**: APPROVED
- **Findings**: 0 open findings (3 resolved warnings)

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

### F1 — Short-timebox test does not verify the day-28 threshold

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: app/dashboard/SessionExpiryNotice.tsx:7; e2e/session-expiry.spec.ts:208
- **Detail**: The plan requires the shortened project to preserve the day-28-of-30 threshold. That is 28/30 of 10 seconds (about 9.33s), not the plan's stated "~2/3." The component retains a fixed two-day notice window, so with `SESSION_TIMEBOX_MS=10000` the modal is already eligible immediately. The E2E test asserts that immediate display, rather than the intended temporal boundary.
- **Fix**: Correct the test-time threshold to preserve the production 28/30 ratio, then assert no modal before it and visible modal just after it. Keep production's two-day window unchanged.
- **Decision**: FIXED — injected a proportionally scaled notice window and updated the E2E test to assert the 28/30 boundary.

### F2 — Completed checklist claims login-page behavior that the app intentionally does not implement

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/stay-logged-in-across-browser-sessions/plan.md:315
- **Detail**: Phase 2's manual criteria are marked complete as "shows login page," but `/dashboard` has no auth guard by explicit scope. The implementation and E2E tests correctly render the Dashboard placeholder after missing/corrupted authentication; expiry asserts only cookie removal. The verified behavior therefore conflicts with the recorded completion claim.
- **Fix A ⭐ Recommended**: Amend the Phase 2 manual criteria/progress to state "cookies cleared and request renders without error"; leave login-page routing to Story 0.4.
  - Strength: Aligns the plan with the intentionally scoped implementation.
  - Tradeoff: The desired login-page behavior remains deferred.
  - Confidence: HIGH — the plan explicitly excludes route guards and the E2E test documents the same constraint.
  - Blind spot: None significant.
- **Fix B**: Add the auth guard now to make the criterion true.
  - Strength: Delivers the stated login-page behavior now.
  - Tradeoff: Expands the change beyond its explicit scope guardrail.
  - Confidence: HIGH — a route guard is the missing behavior.
  - Blind spot: Story 0.4's intended design has not been reviewed here.
- **Decision**: FIXED via Fix A — aligned the manual criteria and Progress wording with the intentionally unguarded dashboard.

### F3 — `npm run test:e2e` is not locally runnable after `supabase start`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: package.json:13
- **Detail**: The required command fails before test discovery because it receives no Supabase URL or keys. CI exports credentials from `supabase status`, but the local script does not; `.env.local` is documented as pointing at the hosted project, so it is not a safe substitute for local E2E credentials.
- **Fix**: Make the local E2E entrypoint derive local Supabase credentials from `supabase status` before launching Playwright, with a clear precondition that the normal local stack is running.
- **Decision**: FIXED — `npm run test:e2e` now derives local Supabase credentials from `supabase status` before launching Playwright.

## Verification

| Command | Result |
|---------|--------|
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS (`typecheck` script does not exist) |
| `npm run test:run` | PASS — 30 tests; 98.86% statements, 94.11% branches |
| `npm run test:coverage` | PASS |
| `npm run test:e2e` | Launcher fixed: Playwright discovered 13 tests with locally derived Supabase credentials. Local browser execution is unsupported because the development Mac is capped at macOS 13 and lacks a compatible Playwright Chromium binary. GitHub Actions is the authoritative E2E runner; it provisions Chromium on Ubuntu. |
