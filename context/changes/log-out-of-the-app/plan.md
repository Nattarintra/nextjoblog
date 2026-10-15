# Log Out of the App — Implementation Plan

## Overview

Story 0.5. A logged-in Job Seeker opens an Account sheet from a shared top bar and clicks **Log Out**. A Server Action ends only the *current* Supabase session (`signOut({ scope: "local" })`); on success the client `router.replace("/login?loggedOut=1")`, where a success banner is shown. If sign-out fails, the action re-checks the session before deciding what to show: redirect if it is gone, "still logged in" error + **Try Again** if it is still valid, generic confirmation error + **Try Again** if verification fails. Back after logout never shows an authenticated page (Story 0.4 guard + `no-store` on protected responses + `replace`).

## Current State Analysis

- No log-out feature exists. `app/actions/auth.ts` has only `signup`/`login`; the only `signOut()` is `app/api/auth/session-expired/route.ts:11` with the default **global** scope (not to be copied; fixed in a separate follow-up change).
- `app/(protected)/layout.tsx` renders `children` + `SessionExpiryNotice` only; the dashboard is a bare `<h1>`. There is no top bar and nowhere for the control.
- `getEffectiveSessionExpiry()` (`lib/session/service.ts`, `cache()`d) already returns `claims` for authenticated users, so `claims.email` is available to the layout without another lookup.
- `proxy.ts` sets `no-store` only on redirects (`createAuthRedirect`). Protected page responses carry no cache header today.
- `app/login/page.tsx` reads only `next`; `LoginAlert.tsx` has error + warning alerts and no success variant; `app/globals.css` has no `--success-*` / `--paper` tokens.
- `useSessionExtension.ts` is the house pattern for a client hook over a Server Action (`useActionState` + `startTransition` + `navigator.onLine` guard).
- `vitest.config.mts`: 80% global, 90% for `lib/auth/**`; `proxy.ts` and `lib/supabase/server.ts` are coverage-excluded; no `coverage.include`.

## Desired End State

- On any protected page a top bar shows an **Account** button (`aria-label="Account"`). It opens a light bottom sheet with avatar initial, the user's email, "Logged in on this device", **Log Out** and **Close**.
- Click **Log Out** → button disabled with "Logging out…" → cookies cleared → URL is `/login?loggedOut=1` showing a `role="status"` banner "You've been logged out. Your applications are no longer visible on this device." The history entry for the dashboard is replaced, and no `next` is carried.
- Back from login triggers a request for the protected page → proxy/DAL redirect to `/login?next=%2Fdashboard`; no dashboard markup. Protected responses carry `Cache-Control: private, no-store, max-age=0`.
- A second browser context for the same user stays logged in (local scope).
- Failure outcomes: session gone → redirect; still authenticated → sheet open, `role="alert"` "We couldn't log you out. You're still logged in on this device. …" + Try Again; verification failed → generic message without "still logged in" + Try Again. Offline → action not dispatched, offline message, Try Again after reconnect.
- `npm run test:coverage` passes (≥ 80% global, ≥ 90% `lib/auth/**`); `e2e/logout.spec.ts` covers every acceptance criterion.

### Key Discoveries:

- `_signOut` (`GoTrueClient.js:3415-3443`) removes the local session even for some error returns, so the error type does not tell us whether cookies are gone — hence the post-error `getClaims()` re-check.
- Server Action `redirect()` uses `push` (`redirect.md:31`); logout must return typed state and navigate client-side with `replace`.
- `"use server"` files may export only async functions; factory/types/constants live in non-action modules (`lib/auth/`), mirroring `createRequireSession(deps)`.
- Cookie writes work in Server Actions (not Server Components), so `signOut` belongs in an action.
- `proxy.ts` rebuilds `response` inside `setAll`; headers must be applied to the *final* response, after the auth call.

## What We're NOT Doing

- Logging out of all devices / global scope.
- Bottom navigation (only the top bar + Account button).
- An "are you sure?" confirmation step.
- Fixing the existing `session-expired` route's implicit global `signOut()` — separate change `fix-expired-session-local-sign-out`.
- Deleting `session_extensions` rows on logout (orphaned row is harmless; no schema change).
- Touching the Google Calendar connection or any user data.
- Redirecting already-authenticated users away from `/login`.
- A logout control on the `verification_failed` screen: the top bar renders only when `status === "authenticated"`, so `SessionCheckFailed` has no Account button (accepted gap; revisit separately).

## Implementation Approach

Four layers, pure-first, each single-responsibility and injected for testability:

1. `lib/auth/sign-out.ts` — `signOutCurrentSession(client)` knows Supabase only; returns a discriminated `SignOutResult`.
2. `lib/auth/logout.ts` — `createLogout({ createClient, log })` factory maps the result to `LogoutState` (success / still-signed-in / verification-failed / configuration / unknown) and logs code/status only.
3. `app/actions/logout.ts` — `"use server"`, exports only the default-wired async `logout`.
4. UI — `useLogout` hook (offline guard, `router.replace` on success) + `AccountMenu` / `AccountSheet` presentational components, mounted by the presentational protected layout.

```
app/
  actions/logout.ts                       ★ "use server": logout(_state)
  actions/logout-messages.ts              ★ user-facing strings + log label
  (protected)/
    layout.tsx                              + <AppTopBar email=…/>
    _components/
      AppTopBar.tsx                       ★ server-safe: title + <AccountMenu/>
      AccountMenu.tsx                     ★ client: trigger + open state + focus return
      AccountSheet.tsx                    ★ client: dialog markup
      useLogout.ts                        ★ hook
      account-initial.ts                  ★ pure
  login/page.tsx, LoginForm.tsx, LoginAlert.tsx   + loggedOut banner
lib/auth/
  paths.ts                                + LOGGED_OUT_PARAM_NAME/VALUE, PROTECTED_CACHE_CONTROL
  login-redirect.ts                       + buildLoggedOutLoginUrl()
  sign-out.ts, logout.ts                  ★
  protected-cache.ts                      ★ applyProtectedCacheControl(response, pathname)
app/globals.css                           + --success-*, --paper tokens
```

## Critical Implementation Details

- **Scope must be explicit.** `signOut({ scope: "local" })` exactly once; a unit test asserts the argument so the global-scope regression cannot return.
- **Post-error re-check.** On `signOut` error (or throw), call `getClaims()` and classify with existing `classifyClaimsResult`/`classifyThrown`: `unauthenticated` → success outcome (redirect); `authenticated` → `still_signed_in`; `verification_failed` → `unconfirmed`.
- **Navigation is client-only.** The action never calls `redirect()`; success state is `{ ok: true }` and `useLogout` calls `router.replace(buildLoggedOutLoginUrl())` in an effect. No `router.refresh()` unless E2E proves it is needed (then record it as a deviation). **Unverified:** the Server Action's own cookie-mutation re-render runs the page's `requireSession()` and may issue `redirect("/login?next=%2Fdashboard")` that races the client `replace`; the Phase 2 spike gate settles this before any UI work (fallback: Route Handler / `fetch` logout with no router re-render).
- **`loggedOut` is presentation-only.** Never used for authorization; the login page reads it solely to render the banner. Banner and return strip are mutually exclusive: the banner wins when `loggedOut=1`, and logout never emits `next`.
- **No raw errors in logs.** Log `{ code, status }` via the same `logAuthEvent`-style safe pattern; do not copy `session.ts`'s `console.error(label, error)`.
- **`no-store` applied to final proxy response** for non-public paths only (public/auth paths and static assets unaffected); implemented through a pure helper so it is unit-tested despite `proxy.ts` being coverage-excluded.
- **Overlay stacking.** `SessionExpiryNotice` is `fixed z-50`. The account sheet uses `z-40` so an expiry notice always wins and opening the sheet never hides it.
- **Contrast.** Verify the red-outlined Log Out text/border against the paper background ≥ 4.5:1 using `--danger-fg`; do not copy the wireframe's lighter `--danger`.

---

## Phase 1: Pure logout core and constants

### Overview

All decision logic as small, table-tested modules in `lib/auth/` (90% gate). No Next imports.

### Changes Required:

#### 1. Constants

**File**: `lib/auth/paths.ts`

**Intent**: One home for the new literals.

**Contract**: add `LOGGED_OUT_PARAM_NAME = "loggedOut"`, `LOGGED_OUT_PARAM_VALUE = "1"`, `PROTECTED_CACHE_CONTROL = "private, no-store, max-age=0"` (may alias `AUTH_REDIRECT_CACHE_CONTROL`).

#### 1b. Shared helpers (extract, don't duplicate)

**Files**: `lib/auth/route-access.ts`, `lib/auth/log.ts` (new), `app/actions/auth.ts`, the module that holds `useSessionExtension`'s offline message

**Intent**: Plan reuses symbols that are private today.

**Contract**: export `isPublicPath` from `route-access.ts`; move `logAuthEvent` out of `app/actions/auth.ts` into `lib/auth/log.ts` (auth.ts imports it, behaviour unchanged, no raw error objects); export the existing offline message constant (`OFFLINE_ERROR_MESSAGE` in `useSessionExtension.ts`) to a shared module and import it from both hooks.

#### 2. Logged-out URL builder

**File**: `lib/auth/login-redirect.ts`

**Contract**: `buildLoggedOutLoginUrl(): string` → `/login?loggedOut=1`; never emits `next`.

#### 3. Sign-out service

**File**: `lib/auth/sign-out.ts`

**Intent**: Provider call + post-error session re-check, nothing else.

**Contract**:
```ts
type SignOutResult =
  | { kind: "signed_out" }
  | { kind: "still_signed_in"; code?: string; status?: number }
  | { kind: "unconfirmed"; code?: string; status?: number };
signOutCurrentSession(auth: Pick<SupabaseClient["auth"], "signOut" | "getClaims">): Promise<SignOutResult>
```
`signOut({ scope: "local" })` no error → `signed_out`. Error or throw → `getClaims()` → classify: unauthenticated → `signed_out`; authenticated → `still_signed_in`; verification_failed/throw → `unconfirmed`. `code`/`status` extracted from the original error only when present.

#### 4. Logout orchestration

**File**: `lib/auth/logout.ts`

**Contract**:
```ts
type LogoutState = undefined | { ok: true }
  | { error: "still_signed_in" | "unconfirmed" | "configuration" | "unknown"; message: string };
createLogout(deps: { createClient: () => Promise<{ auth: … }>; log: (event, meta) => void }): (state: LogoutState) => Promise<LogoutState>
```
`SupabaseConfigError` → `configuration`; other throw → `unknown`; result mapped by lookup table (open for a future global option). Messages come from `logout-messages.ts`.

#### 5. Messages and initial helper

**Files**: `app/actions/logout-messages.ts`, `app/(protected)/_components/account-initial.ts`

**Contract**: message constants (still-signed-in, unconfirmed, configuration, unknown, offline, pending label, logged-out banner); `deriveAccountInitial(email: string | undefined): string` → uppercase first letter, fallback glyph for empty/non-letter.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run __tests__/lib/auth`
- `signOutCurrentSession` asserts `signOut` called once with `{ scope: "local" }`; covers success (no error returned, which includes auth-js's swallowed 401/403/404), network error + no session, error + still authenticated, error + verification failure, throw
- `createLogout` covers success, each error state, `SupabaseConfigError`, and that log args contain only code/status (no error object, no email)
- Coverage `lib/auth/**` ≥ 90%: `npm run test:coverage`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Reviewer confirms in PR review: no magic strings outside `paths.ts` / messages module; no framework imports in the pure modules.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Server Action and hook

### Overview

Wire the core into a `"use server"` action and the client hook.

### Changes Required:

#### 1. Action

**File**: `app/actions/logout.ts`

**Intent**: Thin wiring only.

**Contract**: `"use server"`; `export async function logout(state: LogoutState): Promise<LogoutState>` = `createLogout({ createClient: createServerSupabaseClient, log: logAuthEvent-equivalent })`. Exports nothing else.

#### 2. Hook

**File**: `app/(protected)/_components/useLogout.ts`

**Intent**: Reusable by any future entry point.

**Contract**: `useLogout(): { logout(): void; errorMessage: string | null; isPending: boolean }`. Offline (`!navigator.onLine`) → set offline message, do not dispatch. Ignore calls while pending. Success state → `router.replace(buildLoggedOutLoginUrl())` once. `isPending` reports `true` from dispatch until navigation (`isPending || state?.ok === true`), so the button stays disabled in the window between the action resolving and `replace` running.

#### 3. E2E failure hook

**Files**: `lib/auth/test-hooks.ts`, `app/actions/logout.ts`

**Intent**: Playwright cannot intercept the server-side `signOut`; force the failure branches with the same production-inert convention as `e2e-session-check`.

**Contract**: `TEST_LOGOUT_COOKIE = "e2e-logout"`; `applyTestLogoutOverride({ env, cookieValue })` returns `"fail" | "unconfirmed" | undefined`, only when `NODE_ENV !== "production"` and `E2E_TEST_HOOKS === "1"`. The action reads the cookie and passes the result into `createLogout` as an injected `forcedOutcome` dep (the pure core stays free of `next/headers`).

#### 4. Spike gate (do first)

**Intent**: Retire the re-render-race risk before Phases 3–5 build on it.

**Contract**: wire `logout` + `useLogout` to a throwaway button on the dashboard; log out in `next dev` and a production build. Record in this plan the final URL, whether `next=` appears, and history length. If the final URL is not `/login?loggedOut=1`, stop and re-plan (Route Handler / `fetch` option) before Phase 3.

### Success Criteria:

#### Automated Verification:

- `__tests__/actions/logout.test.ts` and `__tests__/protected/useLogout.test.tsx` pass (idle→pending→error, retry re-invokes, success uses `replace` not `push`, double-click ignored, button stays disabled after success until navigation, offline does not dispatch and retry stays available)
- Test hook unit tests pass: override only with `E2E_TEST_HOOKS=1` and non-production; ignored otherwise
- Coverage gates hold; type checking and lint pass

#### Manual Verification:

- Spike gate: after Log Out on the throwaway button, final URL is `/login?loggedOut=1` (no `next=`), history entry replaced, in both `next dev` and a production build. Result recorded in this plan.

**Spike result (2026-10-15, `next dev`, Chrome via Playwright, local Supabase): FAILED.** After Log Out on the throwaway button, cookies were cleared (sign-out worked) but the final URL was `/login?next=%2Fdashboard`, not `/login?loggedOut=1`; history length was unchanged at 3. The Server Action's cookie-mutation re-render ran the page's `requireSession()` and its redirect won the race against the client `router.replace`. Production build not tested (dev result already triggers the stop condition). Re-plan needed before Phase 3: Route Handler / `fetch` logout with no router re-render (fallback named in Critical Implementation Details).

**Deviation (decided after spike): logout is a Route Handler, not a Server Action.** `POST /api/auth/logout` (`app/api/auth/logout/route.ts`, `/api/auth` is already public in the proxy) runs `createLogout` and returns the `LogoutState` as JSON with `no-store`; `app/actions/logout.ts` was removed. `useLogout` now uses `fetch` + local state and `router.replace(buildLoggedOutLoginUrl())` on `{ ok: true }`. The `e2e-logout` cookie hook is read in the route. **Re-run result: PASS** in `next dev` and a production build — final URL `/login?loggedOut=1`, no `next=`, auth cookies cleared, history length unchanged (entry replaced), Back goes to the pre-dashboard page, not the dashboard.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Tokens, top bar, Account sheet

### Overview

Visible UI in the shared protected layout; layout stays presentational.

### Changes Required:

#### 1. Tokens

**File**: `app/globals.css`

**Contract**: add `--success-tint`, `--success-fg`, `--paper` and register as `--color-*`.

#### 2. Layout and top bar

**Files**: `app/(protected)/layout.tsx`, `_components/AppTopBar.tsx`

**Intent**: Render `<AppTopBar email={claims.email}/>` when `effective.status === "authenticated"`; pass only a string across the client boundary. Do not call `requireSession()` in the layout (guard stays per page; `protected-pages-guard.test.ts` keeps passing).

#### 3. Menu and sheet

**Files**: `AccountMenu.tsx`, `AccountSheet.tsx`

**Contract**: `AccountMenu({ email })` owns open state; trigger `<button type="button" aria-label="Account" aria-haspopup="dialog" aria-expanded>`; focus returns to trigger on close. `AccountSheet({ email, isPending, errorMessage, onLogout, onClose })`: `role="dialog" aria-modal="true" aria-labelledby`, initial focus on Log Out, Escape/Close dismiss, Tab trap via `useDialogKeyboardNavigation`, `min-h-11` targets, `focus-visible:ring-2`, `aria-busy` + "Logging out…" while pending, error in `LoginErrorAlert` (`role="alert"`) with button label **Try Again** after a failure. Light bottom-pinned sheet, `z-40`. Single modal owner: the sheet closes (or is `inert`) while `SessionExpiryNotice` is open, so two `aria-modal` dialogs and two focus traps never coexist; the layout passes the signal down. Email row falls back to a neutral label when `claims.email` is undefined.

### Success Criteria:

#### Automated Verification:

- `AccountMenu`/`AccountSheet` tests: accessible name, `aria-expanded` toggles, email + initial rendered, email fallback when undefined, disabled + `aria-busy` while pending, alert role, Escape/Close, focus in/out, sheet closes when the expiry notice opens
- Protected layout test: passes email when authenticated, renders no top bar otherwise
- `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` pass

#### Manual Verification:

- Sheet matches wireframes 00.8/00.10; contrast of Log Out ≥ 4.5:1
- Keyboard-only and screen-reader pass; expiry notice appears above the sheet

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Login banner and `no-store`

### Overview

Close the loop on the login side and the Back-button cache requirement.

### Changes Required:

#### 1. Logged-out banner

**Files**: `app/login/page.tsx`, `app/login/LoginForm.tsx`, `app/login/LoginAlert.tsx`

**Contract**: page reads `loggedOut`; `=== "1"` → `LoginLoggedOutAlert` (`role="status"`, success tokens) above fields, email empty, return strip suppressed. Any other value → nothing.

#### 1b. Baseline check (do first)

**Intent**: The plan assumes protected responses lack `no-store`, but dynamic pages reading `cookies()` may already send it.

**Contract**: `curl -I` a logged-in `/dashboard` before writing the helper and record the header. If already `no-store`, keep the helper as an explicit, unit-tested guard (cheap and decoupled from framework defaults); otherwise proceed as planned.

#### 2. Protected `no-store`

**Files**: `lib/auth/protected-cache.ts`, `proxy.ts`

**Contract**: `applyProtectedCacheControl(response, pathname)` sets `Cache-Control: private, no-store, max-age=0` when the path is non-public (uses the `isPublicPath` exported in Phase 1). `proxy.ts` calls it on the final non-redirect response.

### Success Criteria:

#### Automated Verification:

- Login page/alert tests: banner only for `loggedOut=1`; `next` still sanitised; banner and return strip never together
- Helper tests: protected path gets header; `/login`, `/signup`, `/api/auth/*` do not; `__tests__/proxy.test.ts` extended
- Coverage gates, types, lint pass

#### Manual Verification:

- `curl -I` on a logged-in `/dashboard` shows `cache-control: private, no-store, max-age=0`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: E2E, docs, follow-up

### Overview

Prove every acceptance criterion in a real browser and record the housekeeping.

### Changes Required:

#### 1. E2E

**File**: `e2e/logout.spec.ts`

**Intent**: Pattern after `route-guard.spec.ts`. Extract `authCookieStorageKey`/`isAuthSessionCookie` (private in `session-expiry.spec.ts`) to `e2e/helpers/auth-cookies.ts` and import them from both specs.

**Contract**: scenarios — (1) happy path → URL `/login?loggedOut=1`, auth cookies gone; (2) `page.goBack()` → `/login?next=%2Fdashboard`, no dashboard content; (3) protected response `cache-control` contains `no-store`; (4) second context for same user remains authenticated; (5) set the `e2e-logout=fail` cookie (Phase 2 hook; `page.route` cannot see the server-side `signOut`) → sheet open with still-signed-in error, then clear the cookie and Try Again succeeds; repeat with `e2e-logout=unconfirmed` → generic error without "still logged in"; (6) offline context → offline message, retry works after reconnect. Assert cookies/redirects, not the banner, as proof of logout.

#### 2. Coverage visibility

**File**: `vitest.config.mts`

**Intent**: Decide gate for UI files (research item 13). Default: do not add `coverage.include` globally; instead review per-file coverage for the new files and record it in Progress.

#### 3. Docs

**Files**: `docs/route-guard.md` (logout + Back behaviour), `supabase/docs/Nextjoblog-supabase-schema.md` (document `session_extensions` and that it is not cleaned at logout), and create `context/changes/fix-expired-session-local-sign-out/change.md` via `/10x-new`.

### Success Criteria:

#### Automated Verification:

- `npm run test:run` (with coverage) and `npm run test:e2e` pass locally; GitHub Actions `unit-tests` and `e2e-tests` green
- Lint, types, build pass

#### Manual Verification:

- Two-tab journey: log out in one tab, other tab's next navigation lands on login
- Vercel preview (optional; skip if no preview environment): logged-out `curl -sI /dashboard` still 307 + no-store; logout from preview works and cookies are cleared
- Docs updated (`docs/route-guard.md`, schema doc) and `fix-expired-session-local-sign-out` change created

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before archiving the change.

---

## Testing Strategy

### Unit Tests:

- Pure/service: `sign-out`, `logout`, `buildLoggedOutLoginUrl`, `deriveAccountInitial`, `applyProtectedCacheControl`.
- Action via factory with injected fakes (no Next module mocking); hook with real `useActionState` and injected action where possible.
- Components by role/label (Testing Library + user-event), never by class.
- Conventions: `vi.hoisted` + `vi.mock`, `cleanup()` in `beforeEach`.

### Integration Tests:

- Playwright `e2e/logout.spec.ts` (six scenarios above), single worker, unique `+${Date.now()}` emails.

### Manual Testing Steps:

1. Log in → Account → Log Out → login with banner; dashboard URL not reachable with Back.
2. Throttle/offline → error + Try Again; reconnect → success.
3. Log in on two browsers; log out on one; other stays logged in.
4. Keyboard and screen-reader pass of sheet and banner.

## Performance Considerations

No extra network calls on normal render (email comes from the already-cached claims). Logout does one `signOut` request, plus one `getClaims()` only on failure.

## Migration Notes

No database migration. `session_extensions` row for the ended session is intentionally left orphaned. No URL changes; `/login` gains an optional presentation-only `loggedOut` query parameter.

## References

- Research: `context/changes/log-out-of-the-app/research.md`
- Wireframes: `supabase/docs/nextjoblog-mvp-screens.html` (00.8–00.10, dev notes `:2581-2583`)
- Next docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`, `use-router.md`, `…/03-file-conventions/proxy.md`
- Patterns: `lib/auth/require-session.ts` (DI factory), `app/(protected)/_components/useSessionExtension.ts`, `SessionExpiryNoticeDialog.tsx`
- Prior stories: `context/changes/redirect-unauthenticated-users/`, `context/archive/2026-09-07-log-in-an-existing-account/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure logout core and constants

#### Automated

- [x] 1.1 Unit tests for sign-out service and logout orchestration pass
- [x] 1.2 signOut is called once with scope local and every failure branch is covered
- [x] 1.3 Coverage for lib/auth/** is at least 90%
- [x] 1.4 Type checking passes
- [x] 1.5 Linting passes

#### Manual

- [x] 1.6 Code review: no magic strings outside paths and messages, no framework imports in pure modules

### Phase 2: Server Action and hook

#### Automated

- [x] 2.1 Logout action tests pass
- [x] 2.2 useLogout tests cover retry, replace navigation, double-click, and offline
- [x] 2.3 Coverage gates, types, and lint pass
- [x] 2.5 E2E logout test hook unit tests pass and are inert in production

#### Manual

- [x] 2.4 Spike gate: logout via the action ends on /login?loggedOut=1 with no next in dev and production build

### Phase 3: Tokens, top bar, Account sheet

#### Automated

- [x] 3.1 AccountMenu and AccountSheet component tests pass — 66b1c82
- [x] 3.2 Protected layout test passes — 66b1c82
- [x] 3.3 Full suite, build, types, and lint pass — 66b1c82

#### Manual

- [x] 3.4 Sheet matches wireframes and Log Out contrast is at least 4.5:1 — 66b1c82
- [x] 3.5 Keyboard and screen-reader pass; expiry notice stacks above the sheet — 66b1c82

### Phase 4: Login banner and no-store

#### Automated

- [x] 4.1 Login page and alert tests pass
- [x] 4.2 Protected cache header helper and proxy tests pass
- [x] 4.3 Coverage gates, types, and lint pass

#### Manual

- [x] 4.4 Protected response shows cache-control no-store via curl (verified on a production build: `private, no-store, max-age=0`; `next dev` sends `no-cache, must-revalidate` — framework dev override)

### Phase 5: E2E, docs, follow-up

#### Automated

- [x] 5.1 Unit suite with coverage and Playwright logout spec pass locally (unit: 230 pass, 94.8% stmts, lib/auth 98.6%; E2E ran green in CI — not locally, Chromium unsupported on macOS 13). Deviation found by E2E: useLogout uses window.location.replace instead of router.replace so Back cannot show a Next client-cache page — f922b50
- [x] 5.2 GitHub Actions unit-tests and e2e-tests jobs are green
- [x] 5.3 Lint, types, and build pass

#### Manual

- [ ] 5.4 Two-tab logout journey verified by hand
- [ ] 5.5 Vercel preview logout and no-store headers verified
- [x] 5.6 Docs updated and fix-expired-session-local-sign-out change created
