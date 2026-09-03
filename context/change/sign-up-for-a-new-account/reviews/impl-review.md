<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sign Up for a New Account

- **Plan**: `context/change/sign-up-for-a-new-account/plan.md`
- **Scope**: Phases 0–3 complete; Phase 4 implementation reviewed with verification pending
- **Date**: 2026-09-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 8 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Verification evidence

| Check | Result |
|---|---|
| `npm ls vitest @vitejs/plugin-react @testing-library/react` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run test:run` | FAIL — Vitest discovers `e2e/signup.spec.ts`; 5 unit tests pass, then Playwright `test.beforeAll()` throws under Vitest |
| `npm run build` | BLOCKED LOCALLY — Next.js 16.3.4 Turbopack fails on macOS while binding a process port (`Operation not permitted`) during CSS processing; this is environment-specific and not attributed to the implementation |
| `npx playwright install --dry-run` | PASS — Chromium installation is available in the configured cache; actual browser execution was not possible on this Mac per user context |
| Required grep/file checks | PASS |

Manual progress items 0.6 and 1.5–1.6, 2.6–2.8, and 3.7–3.11 are marked complete in `plan.md`; their prior commit evidence is present, but this review did not independently reproduce the Supabase-backed manual flows. Phase 4 items 4.1, 4.4, 4.5, and 4.6 remain unchecked and are pending Linux CI.

## Findings

### F1 — Vitest runs the Playwright suite

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `vitest.config.mts:7-10`
- **Detail**: `npm run test:run` discovers `e2e/signup.spec.ts` because Vitest has no include/exclude boundary. The command fails with `Playwright Test did not expect test.beforeAll() to be called here`, so the Phase 0–3 automated test criterion is no longer green after adding Phase 4.
- **Fix**: Restrict Vitest to `__tests__/**/*.test.{ts,tsx}` or exclude `e2e/**` in `vitest.config.mts`.
- **Decision**: FIXED — restricted Vitest discovery to `__tests__/**/*.test.{ts,tsx}`

### F2 — E2E seed uses a page without the configured base URL

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `e2e/signup.spec.ts:6-12`
- **Detail**: `browser.newPage()` creates a standalone page/context, while `baseURL` is configured on the Playwright project. Calling `page.goto("/signup")` from this raw page can reject the relative URL before the duplicate-email seed is created. The test fixtures supplied as `{ page }` would inherit `baseURL`.
- **Fix**: Create a context with `{ baseURL: "http://localhost:3000" }` before opening the seed page, or use the `page` fixture in a supported setup structure.
- **Decision**: FIXED — created the seed page with the configured base URL

### F3 — Duplicate seed accepts an unverified failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `e2e/signup.spec.ts:13-18`
- **Detail**: The seed accepts either `/dashboard` or `/signup`. A server-side signup failure that leaves the page on `/signup` can therefore pass `beforeAll` even though `duplicate@example.com` was never provisioned. The catch also ignores any Playwright error containing the word `already`, rather than verifying a Supabase `user_already_exists` result.
- **Fix**: Assert the successful redirect on first provisioning and handle the known rerun condition through deterministic API/database setup or a narrowly identified duplicate response.
- **Decision**: FIXED — seed setup now accepts only a dashboard redirect or the verified duplicate-email alert

### F4 — Auth page wrapper omits the planned centered flex layout

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `app/signup/page.tsx:24-31`
- **Detail**: The plan requires the outermost wrapper to provide a full-viewport centered flex layout. The implementation sets `minHeight` and colors but does not set `display: flex`, `alignItems`, or `justifyContent`. The inner `.auth-wrap` fills the viewport, so this can alter the intended placement/layout at the route boundary.
- **Fix**: Add the required centered flex properties to the outer wrapper, matching the plan and design spec.
- **Decision**: FIXED — added centered flex layout properties to the outer auth wrapper

### F5 — Auth user and profile insert are not atomic

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `app/actions/auth.ts:61-66`
- **Detail**: `auth.signUp()` commits the Auth user before `profiles.insert()`. If the insert fails, the action returns an error but leaves an authenticated, profileless user. A retry becomes a duplicate-email path, so the user can be stranded without a recovery path.
- **Fix**: Provision profiles with a database trigger/RPC or add a deliberate compensating/recovery path and test the failure case.
- **Decision**: FIXED — added a transactional `auth.users` profile trigger and removed the separate application-level profile insert

### F6 — Raw backend error messages are returned to the browser

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `app/actions/auth.ts:51,66,73-75`
- **Detail**: Supabase Auth, profile, and caught exception messages are returned in `SignupFormState` and rendered directly by `SignupForm`. These messages can expose backend details and are not a stable user-facing contract.
- **Fix**: Log detailed errors server-side and return stable, user-safe messages to the client.
- **Decision**: FIXED — backend details are logged server-side and replaced with a stable user-safe error message

### F7 — CI omits the documented database reset

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `.github/workflows/playwright.yml:32-45`
- **Detail**: The plan’s Phase 4 cleanup note says CI should run `supabase db reset` before the suite. The workflow starts Supabase but does not explicitly reset/apply the database state before running tests. A fresh runner is usually clean, but the workflow does not enforce the documented precondition.
- **Fix**: Run `supabase db reset` after `supabase start` and before exporting credentials/running E2E tests.
- **Decision**: FIXED — added an explicit Supabase database reset before E2E execution

### F8 — CI workflow is an unplanned scope addition

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: `.github/workflows/playwright.yml:1-53`
- **Detail**: Phase 4 Changes Required lists the Playwright config, package changes, and E2E file; the workflow is extra. It is related to the stated Linux validation goal and is benign, but should be explicitly added to the plan or treated as follow-up scope so the plan remains the source of truth.
- **Fix**: Document the CI workflow as a Phase 4 addendum, including its Supabase and artifact behavior.
- **Decision**: FIXED — documented the Linux CI workflow as intentional Phase 4 scope for macOS-compatible E2E validation

### F9 — Supabase CLI version is unpinned

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `.github/workflows/playwright.yml:28-30`
- **Detail**: CI installs `version: latest`, allowing future CLI changes to alter local Auth/migration behavior without a repository change.
- **Fix**: Pin a known-compatible CLI version and update it deliberately.
- **Decision**: FIXED — pinned the Supabase CLI to version `2.74.5`
