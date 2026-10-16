<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Log Out of the App

- **Plan**: context/changes/log-out-of-the-app/plan.md
- **Mode**: Deep (claims verified inline against code; no sub-agent)
- **Date**: 2026-10-15
- **Verdict**: SOUND (initial: REVISE; all 8 findings fixed in plan.md during triage)
- **Findings**: 2 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS (was WARNING) |
| Lean Execution | PASS |
| Architectural Fitness | PASS (was WARNING) |
| Blind Spots | PASS (was FAIL) |
| Plan Completeness | PASS (was WARNING) |

## Grounding

14/14 existing paths ✓ (`context/foundation/lessons.md` and `docs/reference/contract-surfaces.md` absent — skipped), symbols ✓ except 2 private (F6, F7), brief↔plan ✓, Progress↔Phase ✓ (one `## Progress` at bottom, phases 1–5 match, criteria map to 1.1–5.6, no stray checkboxes in phase blocks).

## Findings

### F1 — E2E failure scenario cannot intercept a server-side call

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 — E2E scenario 5; research §E
- **Detail**: Plan uses `page.route("**/auth/v1/logout", abort)`. `signOut` runs inside the Server Action on the Next server, so Playwright's browser-level routing never sees that request. The still-signed-in / unconfirmed UI branches (AC "Error Handling") would have no E2E proof. The repo's existing pattern for this is a test hook (`lib/auth/test-hooks.ts`, cookie `e2e-session-check`, gated by `E2E_TEST_HOOKS=1` + non-production, set in `playwright.config.ts:23`).
- **Fix**: Add a sibling hook (e.g. `e2e-logout=fail|unconfirmed`) consumed by the logout wiring; E2E sets the cookie, then clears it for the Try Again step. Add to Phase 2 and the Phase 5 scenario.
  - Strength: Mirrors an existing, production-inert convention; deterministic.
  - Tradeoff: Small test-only branch in production code path.
  - Confidence: HIGH — identical mechanism already used by `applyTestSessionOverride`.
  - Blind spot: Where the hook is read (action vs factory deps) must keep `lib/auth/logout.ts` free of `next/headers`.
- **Decision**: FIXED (Fix in plan: e2e-logout test hook, Phase 2 + Phase 5)

### F2 — Action re-render may race the client `router.replace`

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 2 hook; Critical Implementation Details "Navigation is client-only"; brief "Open Risks"
- **Detail**: A Server Action that mutates cookies makes Next re-render the current route in the action response. The dashboard page then runs `requireSession()`, which finds no session and issues `redirect("/login?next=%2Fdashboard")` (push semantics). That can land instead of / before `replace("/login?loggedOut=1")`: wrong URL, no banner, `next` return strip, extra history entry. Plan treats cookie-mutation refresh as benign and only reserves `router.refresh()`. Not confirmed in the local Next docs (`cookies.md`, `redirect.md`).
- **Fix A ⭐ Recommended**: Time-boxed spike at the start of Phase 2 (action + hook + dashboard, manual + one Playwright check) before Phases 3–5 build on it; decide architecture from the result.
  - Strength: Cheap, retires the biggest unknown before UI work.
  - Tradeoff: Adds a step; plan structure changes (Phase 2 gets a gate).
  - Confidence: HIGH — failure would invalidate the "action returns typed state, client navigates" decision.
  - Blind spot: Behaviour may differ between `next dev` and production build.
- **Fix B**: Pre-empt by making the post-logout destination robust: call logout via a Route Handler / `fetch` (no router re-render), keep typed JSON state.
  - Strength: No re-render race by construction.
  - Tradeoff: Leaves the Server Action pattern used elsewhere; hand-rolled CSRF/origin considerations; more code.
  - Confidence: MEDIUM — Route Handler cookie writes are proven (session-expired route) but unverified in this flow.
  - Blind spot: Next Router Cache invalidation after a non-action cookie change.
- **Decision**: FIXED (Fix A: spike gate at start of Phase 2)

### F3 — "Still logged in" copy and button state after success

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — `useLogout`
- **Detail**: `isPending` returns to false when the action resolves, before the `useEffect` runs `router.replace`. The Log Out button re-enables during that window and a second click dispatches another `signOut`. Plan's "double-click ignored" test only covers the pending window.
- **Fix**: Treat `state?.ok === true` as busy (`isPending || succeeded`) and add a test.
- **Decision**: FIXED

### F4 — Two aria-modal dialogs can be open simultaneously

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — "Overlay stacking" (`z-40` vs `z-50`)
- **Detail**: `SessionExpiryNoticeDialog` and the new sheet both use `useDialogKeyboardNavigation` and `aria-modal`. `z-index` only fixes visual order: two Tab traps and two initial-focus grabs fight, and a screen reader sees two modals. Plan's manual check ("expiry notice appears above the sheet") does not cover focus behaviour.
- **Fix**: Make the sheet `inert`/closed while the expiry notice is open (single owner of modal state), with a component test.
  - Strength: Removes the conflict instead of styling around it.
  - Tradeoff: Needs a signal from `SessionExpiryNotice` (both are layout siblings) — small shared state.
  - Confidence: MEDIUM — depends on how `useSessionExpiryNotice` exposes open state.
  - Blind spot: Behaviour when the notice appears while the logout request is in flight.
- **Decision**: FIXED

### F5 — `no-store` premise on protected responses is unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Current State Analysis; Phase 4.2
- **Detail**: Plan states protected page responses carry no cache header. Pages that read `cookies()`/`headers()` are dynamically rendered and Next normally emits `no-store` for them already; the claim was only inferred from `proxy.ts` and never checked with `curl -I`. Also `@supabase/ssr` writes its own cache headers in `setAll`, which is exactly where `proxy.ts` rebuilds `response`.
- **Fix**: Add a Phase 4 first step: `curl -I` a logged-in `/dashboard` before writing the helper; if already no-store, keep the helper as an explicit guard and unit-test it, otherwise proceed as planned.
- **Decision**: FIXED

### F6 — "reuse the public-path predicate" and "logAuthEvent-equivalent" refer to private symbols

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2.1 (log), Phase 4.2 (`applyProtectedCacheControl`)
- **Detail**: `isPublicPath` is a non-exported function in `lib/auth/route-access.ts:13`; `logAuthEvent` is a non-exported function in `app/actions/auth.ts:62`. The plan reuses both by name without saying where they move. The implementer must guess (duplicate vs export vs extract). Also the plan defines its own offline message while `useSessionExtension.ts` already has `OFFLINE_ERROR_MESSAGE`.
- **Fix**: Name the moves: export `isPublicPath` from `route-access.ts` (or a shared `paths.ts` helper); extract `logAuthEvent` to `lib/auth/log.ts` and import it in `auth.ts` + logout; export the offline message constant to a shared module.
- **Decision**: FIXED

### F7 — No logout control when session verification fails; email may be undefined

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — layout renders top bar only when `status === "authenticated"`
- **Detail**: If `getEffectiveSessionExpiry` returns `verification_failed`, the user sees `SessionCheckFailed` and no way to log out on a shared device. Not in "What We're NOT Doing". Separately, `claims.email` is optional in `JwtPayload`; only the initial has a fallback, not the email row.
- **Fix**: Add both to "What We're NOT Doing" / Phase 3 contract (email fallback text).
- **Decision**: FIXED

### F8 — Minor plan hygiene

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 1, 5
- **Detail**: (a) "401/403/404-as-success" unit case is just "no error" since auth-js swallows those — rename. (b) Phase 1 manual step is a code review, not human verification — fold into PR review. (c) Progress 5.6 (docs + follow-up change) has no matching success-criteria bullet. (d) Phase 5.5 depends on Vercel preview; mark optional. (e) e2e cookie helpers are private to `session-expiry.spec.ts`; the plan allows extraction — make it a definite step.
- **Fix**: One pass through the plan text for these five edits.
- **Decision**: FIXED
