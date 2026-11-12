<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Set a New Password from a Reset Link

- **Plan**: `context/changes/set-a-new-password-from-a-reset-link/plan.md`
- **Mode**: Deep
- **Date**: 2026-10-22
- **Verdict**: SOUND after triage fixes
- **Findings**: 0 critical, 8 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

5/5 sampled paths found; named auth/session/E2E symbols verified; plan brief and research consistent; no contract-surfaces or foundation lessons file present.

## Findings and Triage

### F1 — Phase 2 focused test missing from Progress

- **Severity**: CRITICAL
- **Decision**: FIXED
- **Fix**: Added a dedicated `2.5 Focused lib/auth test run passes` Progress item and renumbered later Phase 2 items.

### F2 — Session starter token contract underspecified

- **Severity**: WARNING
- **Decision**: FIXED
- **Fix**: The plan now requires passing the latest session tokens returned by `setSession`/`updateUser`, including refreshed or rotated tokens, into the cookie-session starter and testing that behavior.

### F3 — Offline handling absent from the formal state union

- **Severity**: WARNING
- **Decision**: FIXED
- **Fix**: Added `offline` to the UI-facing state union, documented it as a local-only result, and added component-test coverage.

### F4 — E2E DRY migration missed existing callers

- **Severity**: WARNING
- **Decision**: FIXED
- **Fix**: Expanded the migration to include all affected E2E specs and shared session/AMR helpers, while preserving or updating compatibility consumers.

### F5 — Requirement copy had two proposed sources of truth

- **Severity**: WARNING
- **Decision**: FIXED
- **Fix**: Validator rules now use `messageKey`; user-visible requirement copy remains in `lib/auth/messages.ts`.

### F6 — CI evidence had no defined recording location

- **Severity**: WARNING
- **Decision**: FIXED
- **Fix**: Added a structured `Verification Notes` section for CI runs, artifacts, AMR results, and environment differences.

### F7 — Recovery classifier omitted dead-session error variants

- **Severity**: WARNING
- **Decision**: FIXED
- **Fix**: Added missing-session, consumed-refresh-token, and `bad_jwt` variants to the classifier contract and test matrix, mapping them to `expired`.

### F8 — Production runbook described the superseded flow

- **Severity**: WARNING
- **Decision**: FIXED
- **Fix**: Expanded Phase 6 to update the Story 0.7 hand-off and `PASSWORD_RESET_ENABLED` documentation so it describes Server Action completion and auto-login.

## Verification Notes

The review and plan edits were completed without implementation changes. Runtime tests and CI remain implementation-phase verification gates.
