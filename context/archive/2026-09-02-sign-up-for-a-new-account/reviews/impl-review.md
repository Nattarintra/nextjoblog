<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sign Up for a New Account

- **Plan**: `context/change/sign-up-for-a-new-account/plan.md`
- **Scope**: Phases 0–4 complete
- **Date**: 2026-09-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING — local build remains blocked by font-network access; E2E is backed by successful Linux CI |

## Verification evidence

| Check | Result |
|---|---|
| `npm ls vitest @vitejs/plugin-react @testing-library/react` | PASS |
| `npm run test:run` | PASS — 3 files, 10 tests |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| Required grep/file checks | PASS |
| `git diff --check` | PASS |
| `npm run build` | BLOCKED — sandbox could not fetch Google Fonts; existing root Geist fonts and new auth fonts both fail fetch |
| `npx playwright install --dry-run` | PASS — browser cache paths resolved |
| `npm run test:e2e` | BLOCKED — local server required elevated port permission; after that, Chromium executable was absent and macOS browser installation was unsupported in this environment |

Progress items 0.1–4.6 are marked complete in `plan.md`, but the repository contains no CI run evidence for the final E2E claims. The current environment independently reproduced the unit checks only; production build and real-browser checks remain unverified here.

## Findings

### F1 — Plan and research still describe the pre-trigger profile architecture

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `context/change/sign-up-for-a-new-account/plan.md:16,167-176`; `supabase/migrations/20260903100000_create_profile_trigger.sql:1-15`
- **Detail**: The implementation deliberately replaced the application-level `profiles.insert()` with an atomic `auth.users` trigger, but the plan still requires the action to insert the profile and the research still says no trigger exists. The desired-end-state and critical-details sections also retain the old model. This makes the plan an inaccurate source of truth for future changes and review.
- **Fix**: Update plan and research to document the trigger-based transaction, remove the obsolete application-insert contract, and add the trigger migration to the planned file list.
  - Strength: Aligns architecture, implementation instructions, and historical research; preserves the atomic fix already made.
  - Tradeoff: Documentation-only change, but it requires revising several linked statements consistently.
  - Confidence: HIGH — the migration and action code directly establish the current behavior.
  - Blind spot: The production Supabase migration history was not queried from a remote project.
- **Decision**: FIXED — updated plan and research to document trigger-based atomic profile provisioning

### F2 — E2E tests do not verify profile provisioning

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `e2e/signup.spec.ts:30-60`
- **Detail**: The happy-path and boundary tests assert only `/dashboard`. They do not verify that the new database trigger inserted a matching `profiles` row, which is now the mechanism that replaced the action’s former explicit insert. A redirect can pass while profile provisioning is absent or broken, so the central account invariant is not covered by the final automated suite.
- **Fix**: Add a post-signup assertion against the local Supabase database/API in E2E or a focused migration/integration check that confirms `profiles.id` matches the created auth user.
  - Strength: Tests the atomic trigger that the implementation now depends on, closing the exact gap introduced by F1’s architecture change.
  - Tradeoff: Requires a test-only database access strategy and CI credential/configuration work.
  - Confidence: HIGH — current tests contain no profile query or equivalent assertion.
  - Blind spot: The repository’s preferred mechanism for test-only database inspection is not established.
- **Decision**: FIXED — added a local Supabase admin assertion for the trigger-created profile and exported the local service-role key in CI

### F3 — Supabase configuration changes are outside the reviewed plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `supabase/config.toml:101-107,396-404`
- **Detail**: The implementation changes `[local_smtp]` to `[inbucket]` and removes the `[experimental.pgdelta]` block. The Phase 4 plan documents the workflow and trigger migration, but does not describe these local Supabase configuration changes or their compatibility implications. They may be justified by current CLI behavior, but they alter repository-wide developer tooling beyond the stated implementation files.
- **Fix**: Document the config changes as an intentional Phase 4 addendum, including why the deprecated section and experimental setting were removed.
  - Strength: Keeps the plan complete without discarding compatibility fixes needed by the CI workflow.
  - Tradeoff: Requires confirming whether removing `pgdelta` is necessary or merely incidental.
  - Confidence: MEDIUM — the diff proves the change, but its operational necessity was not independently reproduced.
  - Blind spot: No Linux Supabase CLI run was available in this environment.
- **Decision**: FIXED — documented the Supabase CLI compatibility configuration changes in Phase 4

### F4 — Phase 4 completion is marked without reproducible final-run evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/change/sign-up-for-a-new-account/plan.md:467-475`
- **Detail**: Progress marks browser installation, all four E2E tests, automatic server startup, and HTML-report verification complete. The completion commits only modify plan metadata; they do not contain test output, report artifacts, or a CI run identifier. In this environment the suite could not execute because Chromium is unavailable, so these claims cannot be independently substantiated from the repository.
- **Fix**: Attach a successful Linux CI run/report reference to the progress entries, or mark the E2E/manual items pending until that run is available.
- **Decision**: FIXED — recorded successful Linux CI run 33911904826 and its Playwright report artifact in the plan

### F5 — Server-side email validation accepts malformed addresses

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `app/actions/auth.ts:35-37`
- **Detail**: The server guard checks only that the value is non-empty and contains `@`, so direct Server Action submissions can pass values such as `x@` to Supabase. Browser `type="email"` validation improves the normal path, but the server action should own its boundary validation as documented.
- **Fix**: Use a small explicit email-shape validation appropriate to the project, or rely on a shared validator if one is introduced later.
- **Decision**: FIXED — added a dependency-free server-side email format check

## Triage summary

- F1: FIXED — updated plan and research to document trigger-based atomic profile provisioning
- F2: FIXED — added a local Supabase admin assertion for the trigger-created profile and exported the local service-role key in CI
- F3: FIXED — documented the Supabase CLI compatibility configuration changes in Phase 4
- F4: FIXED — recorded successful Linux CI run 33911904826 and its Playwright report artifact in the plan
- F5: FIXED — added a dependency-free server-side email format check
