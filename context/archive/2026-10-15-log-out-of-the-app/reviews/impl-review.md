<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log Out of the App

- **Plan**: context/changes/log-out-of-the-app/plan.md
- **Scope**: Phases 1-5 of 5 (cf4f820..HEAD)
- **Date**: 2026-10-16
- **Overall**: NEEDS ATTENTION (initial); all 10 findings FIXED during triage on 2026-10-16
- **Findings**: 0 critical, 6 warnings, 4 observations
- **Verified**: tsc clean, eslint clean, vitest 234/234, coverage 95.0% overall / lib/auth 98.6%. E2E and `next build` not run locally (CI green per Progress 5.2).

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING (F3, F10) |
| Scope Discipline | WARNING (F2, F3) |
| Safety & Quality | WARNING (F1) |
| Architecture | FAIL (F2, F4, F5) |
| Pattern Consistency | WARNING (F7, F8, F9) |
| Success Criteria | WARNING (F6) |

## Findings

### F1 - Closing the sheet mid-request strands a logged-out user on a protected page
- **Severity**: WARNING | **Impact**: MEDIUM | **Dimension**: Safety & Quality
- **Location**: app/(protected)/_components/AccountSheet.tsx:35, AccountMenu.tsx:51, useLogout.ts:32-37
- **Detail**: `useLogout()` lives in `AccountSheet`, which `AccountMenu` unmounts on Close/Escape (Close is not disabled while pending). Click Log Out, then Close: the server clears cookies, but the hook is unmounted so the `window.location.replace` effect never runs. The dashboard stays visible with a dead session. The expiry notice opening mid-request (`suspended`) has the same effect. Plan-review F4 named this blind spot; never closed.
- **Fix**: Own the hook in a component that stays mounted; pass props down (same change as F2).
- **Decision**: FIXED (shared refactor with F2: useLogout owned by mounted AccountControls)

### F2 - Sheet is not presentational; shipped "Spike" button duplicates it (DRY/SRP/DIP)
- **Severity**: WARNING | **Impact**: HIGH | **Dimension**: Architecture
- **Location**: AccountSheet.tsx:35-53, SpikeLogoutButton.tsx, AppTopBar.tsx:30
- **Detail**: Plan/research §G specify `AccountSheet({ email, isPending, errorMessage, onLogout, onClose })`; code calls `useLogout()` inside. `SpikeLogoutButton` (throwaway Phase 2 control, unplanned) shipped as the desktop Log Out and re-implements the hook call, styles, "Logging out…"/"Log Out" literals and a bare `role="alert"` instead of `LoginErrorAlert`. Label logic differs (sheet has nested ternary + Try Again; spike has none). No tests for AppTopBar/SpikeLogoutButton; E2E is mobile-only.
- **Fix**: Extract presentational `LogoutButton` (styles + idle/pending/retry label). Call `useLogout` once in a mounted `AccountControls`; render sheet (mobile) and button (desktop) from props. Delete `SpikeLogoutButton`.
  - Strength: fixes F1, removes duplication, restores planned props. Tradeoff: touches 4 files. Confidence: HIGH. Blind spot: desktop visual parity untested.
- **Decision**: FIXED (LogoutButton + AccountControls; SpikeLogoutButton deleted; AccountControls tests added)

### F3 - `AuthHistoryGuard` is unplanned and duplicates itself and `PUBLIC_PATH_PREFIXES`
- **Severity**: WARNING | **Impact**: MEDIUM | **Dimension**: Scope Discipline
- **Location**: app/AuthHistoryGuard.tsx:13-72, app/layout.tsx
- **Detail**: Five fix commits (b3b7d9f..922b656) added a root-layout guard absent from plan, Progress and docs/route-guard.md. Reload logic exists twice (inline script + useEffect, linked by a window flag). Public prefixes are hardcoded in the script: a third copy after `paths.ts` and `isPublicPath`. It reloads on every `popstate` on protected pages, including Next's own client Back, so each in-app Back becomes a full reload.
- **Fix A (recommended)**: One implementation: inline `JSON.stringify(PUBLIC_PATH_PREFIXES)` into the script, drop the effect twin, narrow the `popstate` reload if possible, document in plan + route-guard.md. Confidence MED; blind spot: is the effect still needed.
- **Fix B**: Keep code, only document. Cheaper; leaves duplication and reload-on-Back cost.
- **Decision**: FIXED via Fix A (single injected script, effect twin removed, test evals emitted script, documented in docs/route-guard.md)

### F4 - `lib/auth/logout.ts` imports from `app/actions/logout-messages` (inverted layering)
- **Severity**: WARNING | **Impact**: MEDIUM | **Dimension**: Architecture
- **Location**: lib/auth/logout.ts:1, useLogout.ts:5, AccountSheet.tsx:5, LoginForm.tsx
- **Detail**: Pure core depends on the `app/` layer; `app/actions/` no longer holds an action (deleted in the Phase 2 deviation). Offline text lives in `lib/auth/messages.ts`, other copy in `app/actions`.
- **Fix**: Move `LOGOUT_MESSAGES` and `LOGOUT_LOG_EVENT` into `lib/auth/messages.ts`; update imports.
- **Decision**: FIXED (messages + log events moved to lib/auth/messages.ts; app/actions/logout-messages.ts deleted)

### F5 - Client re-creates server state shapes (DRY/SRP)
- **Severity**: WARNING | **Impact**: LOW | **Dimension**: Architecture
- **Location**: useLogout.ts:13, 30, 58; lib/auth/logout.ts:22-27
- **Detail**: `UNKNOWN_FAILURE` duplicates `ERROR_STATES.unknown`; `"ok" in state` / `"error" in state` repeated; offline encoded as `kind: "unknown"`. `logout.ts` also imports `SupabaseConfigError` at runtime, so a future runtime import from client code would pull server config into the bundle.
- **Fix**: New `lib/auth/logout-state.ts` (pure `LogoutState`, `LOGOUT_UNKNOWN_STATE`, `offline` kind, `isLogoutSuccess`/`getLogoutError`); `logout.ts` and the hook import it.
- **Decision**: FIXED (lib/auth/logout-state.ts; offline is its own kind; logout.ts and useLogout share it)

### F6 - Real network path and desktop path untested
- **Severity**: WARNING | **Impact**: LOW | **Dimension**: Success Criteria
- **Location**: useLogout.ts:15-24 (76.7%), AppTopBar.tsx, SpikeLogoutButton.tsx
- **Detail**: `postLogout` (fetch, non-OK, null body, throw) is bypassed because tests inject `request`. No tests for AppTopBar/SpikeLogoutButton. The gate ignores files no test imports, so 95% hides this.
- **Fix**: Table test for `postLogout` with stubbed `fetch`; top-bar test. Both fall out of F2.
- **Decision**: FIXED (stubbed-fetch tests for postLogout; desktop path covered by AccountControls test)

### F7 - Test-hook env gate duplicated
- **Severity**: OBSERVATION | **Impact**: LOW | **Dimension**: Pattern Consistency
- **Location**: lib/auth/test-hooks.ts:12-16, 31-33
- **Detail**: `applyTestSessionOverride` and `applyTestLogoutOverride` each hand-roll the NODE_ENV / E2E_TEST_HOOKS check.
- **Fix**: Extract `isE2eHooksEnabled(env)`.
- **Decision**: FIXED (isE2eHooksEnabled shared by both overrides)

### F8 - Leftover Server Action signature in the factory
- **Severity**: OBSERVATION | **Impact**: LOW | **Dimension**: Pattern Consistency
- **Location**: lib/auth/logout.ts:45-48, app/api/auth/logout/route.ts:25
- **Detail**: `createLogout` returns `(state: LogoutState) => …` and ignores it; route calls `logout(undefined)`. Errors return HTTP 200, so the client's `response.ok` branch only guards 5xx.
- **Fix**: Change to `() => Promise<LogoutState>`.
- **Decision**: FIXED (createLogout returns () => Promise<LogoutState>; route and tests updated)

### F9 - Small a11y and strings gaps
- **Severity**: OBSERVATION | **Impact**: LOW | **Dimension**: Pattern Consistency
- **Location**: AccountSheet.tsx:61, 68-69, 74-78; AppTopBar.tsx:16
- **Detail**: `aria-labelledby` points at the email `<h2>`, so the dialog is announced by email, not "Account". "Log Out", "Close", "Logged in on this device" are inline literals despite Progress 1.6. Brand title is an `<h2>` with no preceding page heading.
- **Fix**: Add an "Account" heading as the label; move the three literals to the messages module.
- **Decision**: FIXED (dialog labelled "Account"; strings in messages; brand title no longer an h2)

### F10 - Plan docs stale after deviations
- **Severity**: OBSERVATION | **Impact**: LOW | **Dimension**: Plan Adherence
- **Location**: plan.md (structure tree, Phase 2/3 text, Progress 2.1)
- **Detail**: Tree still lists `app/actions/logout.ts` and "Server Action"; Progress 2.1 says "Logout action tests pass"; router-to-`window.location` and AuthHistoryGuard only in prose; `SpikeLogoutButton`, `ProtectedAppShell`, `--mist` unlisted.
- **Fix**: One pass over tree and Progress after F2-F4 settle.
- **Decision**: FIXED (plan.md tree, paths, Progress 2.1 wording and Implementation addenda updated)

## Notes

- Security scan: no injection or secrets issues. `POST /api/auth/logout` has no origin check, but Supabase cookies are SameSite=Lax so a cross-site POST carries no session; worst case is forced self-logout. Not raised.
