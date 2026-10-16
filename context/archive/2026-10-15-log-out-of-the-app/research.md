---
date: 2026-10-15
researcher: Natta
git_commit: 4bfe6f55d706fe9c33aec884bf5d3ccca423aec5
branch: feat/log-out-of-the-app
repository: nextjoblog
topic: "Log out of the app (Story 0.5)"
tags: [research, codebase, auth, logout, supabase, session, proxy, server-action]
status: complete
last_updated: 2026-10-15
last_updated_by: Natta
---

# Research: Log out of the app

## Research Question

What exists today in NextJobLog (Next.js 16.3.4 App Router + Supabase SSR) that the log-out story builds on, and what has to be added so that: clicking "Log Out" clears the session and lands on `/login`; Back never shows a cached authenticated page; a failed sign-out shows an error with retry and no ambiguous state; and only the *current* session is ended (task: `context/changes/log-out-of-the-app/change.md`).

## Summary

**There is no log-out feature anywhere in the app.** `grep` for `signOut|logout|log out` finds only the expired-session route handler. Everything the story needs *around* the button already exists; the button, the action and the failure UI do not.

1. **No action, no UI.** `app/actions/auth.ts` exports only `signup` and `login`. The only protected page (`app/(protected)/dashboard/page.tsx:17-21`) renders just `<h1>Dashboard</h1>` — there is no header/nav, so there is nowhere a "Log Out" control lives yet.
2. **The only `signOut()` call is unsuitable to copy.** `app/api/auth/session-expired/route.ts:11` calls `supabase.auth.signOut()` with no options. In the installed `@supabase/auth-js` (`GoTrueClient.js:3405`) the default is `{ scope: 'global' }`, which revokes **every** session of the user on all devices. The story explicitly puts "log out of all devices" **out of scope**, so the new action must pass `{ scope: "local" }`.
3. **Back-button protection has a server-side foundation from Story 0.4**, but this story must also address client history/cache behavior: `requireSession()` runs per request on protected pages, `proxy.ts` redirects unauthenticated requests with `Cache-Control: private, no-store, max-age=0` (`lib/auth/paths.ts:16`, `lib/auth/redirect-response.ts:16`). Logout adds client `router.replace()` and `no-store` on protected page responses, then proves the combined behavior with E2E because the Router Cache/bfcache can restore a rendered page without a server round-trip.
4. **The failure path has a real subtlety:** `_signOut` (`GoTrueClient.js:3415-3443`) ignores 401/403/404 from the server (treats as logged out) but for other errors it **still removes the local session** (`removeCurrentSession()` at `:3434-3436`) and then returns the error. A network failure before the request is sent comes back as an `AuthRetryableFetchError`, and — because the fetch threw — the code path at `:3434` also removes the local session. So "error returned" does not guarantee "cookies still present". The action must re-check claims after an error: redirect if no session remains, show a retryable provider error if authenticated, and show a generic retryable confirmation error if verification itself fails.
5. **Existing building blocks to reuse:** server-client factory, `LOGIN_PATH`, `AUTH_REDIRECT_CACHE_CONTROL`, `logAuthEvent` pattern, `LoginErrorAlert`, the `useActionState` + `startTransition` + `useRouter` hook style from `useSessionExtension`, and the dialog/accessibility conventions from `SessionExpiryNoticeDialog`.

## Detailed Findings

### 1. Auth server actions (`app/actions/auth.ts`)

- `"use server"` module; `signup` (`:69`) and `login` (`:142`) follow a fixed shape: parse `FormData` → `createServerSupabaseClient()` → call Supabase → map provider errors to a typed state union (`SignupFormState`, `LoginFormState`, `:21-34`) → `redirect()` **outside** the `try/catch` (`:139`, `:202`) so `NEXT_REDIRECT` isn't swallowed.
- Errors are logged through `logAuthEvent(event, { code, status })` (`:62-67`) with an `AUTH_LOG_EVENT` constant map (`:12-19`). Comment at `:60-61`: never log raw error objects. The new logout action should reuse this safe logging pattern and define its logout event keys in its own action/shared auth module rather than adding logout responsibility to `auth.ts`.
- `SupabaseConfigError` is caught explicitly and mapped to `{ error: "configuration" }` (`:123`, `:182`). Logout should do the same.
- Note `app/actions/session.ts:23` logs the raw error object (`console.error(label, error)`), which contradicts the `auth.ts` comment — don't copy that style.

### 2. Supabase server client and cookies

- `lib/supabase/server.ts:7-27` — `createServerClient` over `next/headers` `cookies()`. `setAll` swallows write errors (`:21-23`) because cookie writes are unavailable in some render contexts. In a **Server Action** cookie writes are allowed, so `signOut({ scope: "local" })` there will actually delete the auth cookies. (Calling it from a Server Component would silently *not* clear cookies — which is why the expired-session flow uses a Route Handler.)
- `proxy.ts:50`, `:88-93` — proxy clears chunked auth cookies only for a confirmed *expired* session, using `getSupabaseAuthCookieStorageKey(config.url)` + `isChunkLike`. Logout doesn't need this: `@supabase/ssr` removes the storage-key cookies itself on `_removeSession()`. The e2e spec (`e2e/session-expiry.spec.ts:13-27`) already has `authCookieStorageKey()` / `isAuthSessionCookie()` helpers to assert cookies are gone.
- `session_extensions` table (`supabase/migrations/20260917100000_create_session_extensions.sql`) is keyed by `session_id`; a local sign-out ends that session id, so the extension row becomes unreachable. Leave the row in place; do not make cleanup part of logout or allow cleanup failure to block logout. Document the behavior; the code in `lib/session/extension-store.ts` is not required to change.

### 3. Route guard behaviour after logout (Story 0.4 dependency)

- `proxy.ts:21-104` runs `getClaims()` on every non-static request; `decideRouteAccess` (`lib/auth/route-access.ts:20-33`) redirects `unauthenticated` on non-public paths to `/login?next=<path>` via `createAuthRedirect` (307 + no-store).
- `requireSession()` (`lib/auth/require-session.ts:30-53`, wrapped in React `cache`) is the authoritative guard; unauthenticated → `redirect(buildLoginRedirectUrl(path))`, `verification_failed` → renders `SessionCheckFailed`.
- `docs/route-guard.md` states layouts must not be the guard — keep the logout control out of the guard path (`app/(protected)/layout.tsx` is presentational and renders `SessionExpiryNotice`).
- **Post-logout destination:** navigate to `/login?loggedOut=1` with no `next`. The query parameter is presentation-only and lets Login show the success banner; it must never redirect or authorize. A logged-out user should not be told to return to the protected page they just left. `LOGIN_PATH` is in `lib/auth/paths.ts:1`, and `/login` is in `AUTH_PATH_PREFIXES` so the proxy lets it through. Verify `app/login/page.tsx` does not itself redirect authenticated users in a way that races the cookie clear.

### 4. Where the control goes

- Protected layout (`app/(protected)/layout.tsx`) is the natural shared place so every protected page has it — it already composes `children` + a client notice. Dashboard page has no chrome today; there is no navigation component in `components/` (only `Logo.tsx`, `auth/AuthLogo.tsx`, `auth/styles.ts`).
- UI conventions: Tailwind v4 utility strings in a `styles` object (`SessionExpiryNoticeDialog.tsx:11-18`), `min-h-11` touch targets and `focus-visible:ring-2` in `SessionCheckFailed.tsx`, `aria-busy` on pending buttons, a visually-hidden `role="status" aria-live="polite"` region for async status (`SessionCheckFailed.tsx`). Error alert component: `LoginErrorAlert` in `app/login/LoginAlert.tsx` (already reused by the expiry dialog).
- Because logout must show an inline error + retry **without** navigating, it should be a client component using `useActionState` (like `LoginForm.tsx:31` / `useSessionExtension.ts:19`). The Server Action returns typed success/error state; the client navigates with `router.replace("/login?loggedOut=1")` only after confirmed success.

### 5. Client-side caching and Back button

- Next 16 docs: `redirect` in a Server Action uses `push` (`redirect.md:31`), so logout must not rely on a default Server Action redirect. Return typed success and use client `router.replace("/login?loggedOut=1")` so the authenticated entry is not left as the previous history entry. Protected page responses must also set `Cache-Control: private, no-store, max-age=0`; the existing guard remains the final check if Back triggers a request. Relevant docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` and `use-router.md` (`replace`, `refresh`, `bfcacheId`).
- A separate `router.refresh()` is not part of the default design: cookie mutation in a Server Action already causes Next.js to re-render the current route/layout. Add it only if the Playwright Back-button test proves it is necessary.

### 6. Tests and conventions to mirror

- Unit: Vitest + jsdom (`vitest.config.mts`); actions are tested by `vi.mock("@/lib/supabase/server")` with a fake `auth` object (`__tests__/actions/session.test.ts:1-60`, `__tests__/actions/auth.test.ts`). Component tests live under `__tests__/<area>/`. Coverage target in prior research: ≥ 80%.
- E2E: Playwright (`e2e/*.spec.ts`, `scripts/run-e2e.mjs`), sign up a fresh user in `beforeAll`, `mode: "default"`. Route-guard spec (`e2e/route-guard.spec.ts`) shows the pattern for asserting 307 + `cache-control` and `toHaveURL`. Test-only hook `e2e-session-check=fail` (`lib/auth/test-hooks.ts`, inert in production) exists for forcing verification failure; there is no equivalent for forcing `signOut` to fail. The logout E2E can use `page.route()` to abort Supabase GoTrue's `POST /auth/v1/logout`, while unit/component tests cover the conditional post-error outcomes.
- Dev docs: `AGENTS.md` mandates reading `node_modules/next/dist/docs/` before writing Next code — do this for `redirect`, Server Actions (`mutating-data`), and `cookies` in planning.

## Code References

- `app/actions/auth.ts:12-19, 62-67, 69-140, 142-203` — action shape, log events, redirect-outside-try
- `app/api/auth/session-expired/route.ts:8-22` — existing `signOut()` (global scope — do not copy)
- `lib/supabase/server.ts:7-27` — server client / cookie bridge
- `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3405-3443` — `signOut` default scope + error/cookie semantics
- `proxy.ts:21-104`, `lib/auth/route-access.ts:20-33` — optimistic redirect for logged-out users
- `lib/auth/require-session.ts:30-70` — authoritative guard
- `app/(protected)/layout.tsx:8-25`, `app/(protected)/dashboard/page.tsx:10-22` — where a control would mount
- `app/(protected)/_components/useSessionExtension.ts`, `SessionExpiryNoticeDialog.tsx` — client action + error pattern
- `app/login/LoginAlert.tsx`, `app/login/LoginForm.tsx:31` — error alert + `useActionState`
- `lib/auth/paths.ts:1-16` — `LOGIN_PATH`, `AUTH_REDIRECT_CACHE_CONTROL`
- `e2e/session-expiry.spec.ts:13-27`, `e2e/route-guard.spec.ts` — E2E helpers and patterns

## Architecture Insights

- Mutating auth state belongs in a Server Action (cookie-writable). Reuse the typed-state pattern from `login`/`signup`, but keep logout navigation on the client so it can use `router.replace()` and preserve the retry state.
- The guard stack (proxy optimistic + DAL authoritative) already gives "Back → login" *at the server*; the plan only needs to prevent the client from replaying a stale page and to prove it with E2E.
- Treat "logout failed" as: show error, keep user on the page, offer retry; don't infer cookie state from the error type (see Summary #4).

## Open Questions / Decisions for planning

1. **Scope — confirmed:** use `signOut({ scope: "local" })`. This ends only the current Supabase session/device session, while leaving the user's sessions on other devices active. This matches the story's single-session logout requirement; the default `global` scope would incorrectly sign the user out everywhere.
2. **Failure semantics — confirmed:** after `signOut` returns an error, re-check the session before deciding what the user sees. If no local session remains, redirect to `/login?loggedOut=1`; if the user is still authenticated, keep the sheet open and show an error with `Try Again`; if session verification itself fails, show a generic confirmation error that does not claim the user is still logged in, and keep `Try Again`. This avoids an ambiguous or misleading state because `auth-js` can remove the local session before returning some errors.

   ```mermaid
   flowchart TD
     A[signOut scope: local] --> B{Error returned?}
     B -->|No| C[Redirect to /login?loggedOut=1]
     B -->|Yes| D[Re-check session]
     D -->|No session| C
     D -->|Authenticated| E[Keep sheet open\nShow logout error + Try Again]
     D -->|Verification failed| F[Keep sheet open\nShow generic confirmation error + Try Again]
   ```
3. **Where the button lives — confirmed:** put the Account button and logout bottom sheet in a shared protected app shell/layout so every protected page has the same logout entry point. Build only the top bar for this story; the bottom navigation is out of scope. Keep authorization in each protected page's `requireSession()` call — the layout remains presentational and must not become the route guard.

   ```mermaid
   flowchart TD
     R[Protected route request] --> P[ProtectedLayout]
     P --> H[Shared app top bar]
     H --> A[Account button]
     A --> S[Account bottom sheet]
     S --> L[Logout action]
     P --> C[Protected page content]
     C --> G[requireSession guard]
     G -->|Authenticated| V[Render page]
     G -->|Unauthenticated| I[Redirect to Login]
     P -.-> N[Bottom navigation out of scope]
   ```
4. **Back-button strategy — confirmed:** after successful logout, return success from the Server Action and navigate with client `router.replace("/login?loggedOut=1")`, so the authenticated page is not left as the previous history entry. Add `Cache-Control: private, no-store, max-age=0` to protected page responses, and rely on the existing proxy/DAL guard as the final back-navigation check. Do not add a separate `router.refresh()` unless E2E proves it is needed; cookie mutation in a Server Action already causes Next.js to re-render the current route/layout. Validate the full behavior with a real browser E2E using `page.goBack()`.

   ```mermaid
   flowchart TD
     A[User clicks Log Out] --> B[Server Action\nsignOut scope: local]
     B -->|Failure| C[Stay on page\nShow error + Try Again]
     B -->|Success| D[Cookies removed]
     D --> E[router.replace\n/login?loggedOut=1]
     E --> F[Login page]
     F --> G[User presses Back]
     G --> H[Protected request\nCache-Control: no-store]
     H --> I{Proxy / requireSession\nchecks session}
     I -->|No session| F
     I -->|Authenticated| J[Render protected page]
   ```
5. **Offline handling — confirmed:** use the same client-side `navigator.onLine` guard as `useSessionExtension`. When offline, do not dispatch the Logout Server Action; keep the Account sheet open, show `You appear to be offline. Please reconnect and try again.`, and let the user retry manually after reconnecting. Do not retry automatically. Still handle network failures after an online check because `navigator.onLine` is only a hint. Add a component test proving that offline mode does not call the action and that retry remains available.

   ```mermaid
   flowchart TD
     A[User clicks Log Out] --> B{navigator.onLine?}
     B -->|No| C[Keep sheet open\nShow offline error]
     C --> D[User reconnects]
     D --> E[User clicks Try Again]
     E --> B
     B -->|Yes| F[Dispatch Logout Server Action]
     F -->|Network failure| G[Show error + Try Again]
     F -->|Success| H[Continue to router.replace Login]
   ```
6. **Housekeeping — confirmed follow-up:** leave the existing `session-expired` flow unchanged in Story 0.5 and create a separate follow-up change named `fix-expired-session-local-sign-out`. That change should replace the route's implicit global `signOut()` with `signOut({ scope: "local" })`, update its unit test, add coverage proving other sessions remain active, and review the route's raw error logging. Do not include UI, redirect, schema, or `session_extensions` cleanup changes in that follow-up.

   ```mermaid
   flowchart TD
     A[Story 0.5: Log out of the app] --> B[New logout Server Action]
     B --> C[signOut scope: local]
     B --> D[Account sheet + retry UI]
     B --> E[router.replace Login]
     F[Follow-up: fix-expired-session-local-sign-out] --> G[Existing session-expired route]
     G --> H[Replace implicit global signOut]
     H --> I[signOut scope: local]
     G --> J[Update unit + E2E coverage]
     G --> K[Review safe error logging]
   ```

## Related Research

- `context/archive/2026-09-07-log-in-an-existing-account/` — Story 0.2 (login), the lifecycle this completes
- `context/changes/redirect-unauthenticated-users/research.md` — Story 0.4 guard (relied upon for Back-button AC)
- `context/archive/2026-09-15-extend-session-via-stay-loggen-in/` — session extension / expiry notice
- `docs/route-guard.md`, `docs/production-auth.md`

---

## Follow-up Research: Wireframes (Story 0.5) and Supabase Schema

Sources: `supabase/docs/nextjoblog-mvp-screens.html` (screens 00.8–00.10, lines 1687-1842; dev notes at `:2581-2583`) and `supabase/docs/Nextjoblog-supabase-schema.md`. The wireframes number this **Story 0.5**.

### A. The three wireframe screens

| Screen | Template | What it shows |
|---|---|---|
| 00.8 Account sheet | `scr-logout` (`:1688`) | Dashboard dimmed (`opacity: .35`) behind a **bottom sheet**: avatar initial, "Account", the user's email, a neutral row "Logged in on this device", a red-outlined **Log Out** button, and a **Close** button. |
| 00.9 Login after log out | `scr-login-loggedout` (`:1751`) | Normal Log In form with a **green success alert** above the fields: "**You've been logged out.** Your applications are no longer visible on this device." Email field empty. |
| 00.10 Log out failed | `scr-logout-error` (`:1784`) | Same sheet with a **danger alert**: "**We couldn't log you out.** You're still logged in on this device. Check your connection and try again." Buttons: **Try Again** (refresh icon) and **Close**. This is the wireframe's authenticated-failure state; implementation also has a generic verification-failure state and redirects when no session remains. |

Entry point: the **account icon button** (`class="icon-btn" aria-label="Account"`, person glyph) in the Dashboard top bar (`:1854`, `:1957`), beside the title and "Job Seeker · <email>" subtitle. Neither the top bar nor the bottom nav exists in code yet (the dashboard is only an `<h1>`).

Design decisions in the dev notes (`:2581-2583`), reconciled with the confirmed decisions above:
1. **No "are you sure?" confirmation** — AC goes straight from click to login.
2. `supabase.auth.signOut({ scope: "local" })` **explicitly** (matches first-part finding #2).
3. Button shows a spinner and is **disabled while pending** (no double fire).
4. On success: clear caches, then `router.replace('/login?loggedOut=1')` — `replace`, **not** `push`, so Back doesn't return to an authenticated page.
5. Banner only when `loggedOut=1`; **no `next` carried over** — re-login lands on `/dashboard`.
6. Back relies on the Story 0.4 guard **plus `Cache-Control: no-store` on protected pages**.
7. Failure: if the post-error session check confirms the user is still authenticated, the sheet stays open, the shell stays visible, and Try Again repeats the same action. If no session remains, redirect to Login; if verification fails, show a generic confirmation error and keep Try Again available. Close dismisses the sheet without changing the session.

### B. Where the wireframe and the codebase disagree or leave gaps

- **"Clear the TanStack/route caches"** — there is no TanStack Query in `package.json`. The equivalent here is the Next client Router Cache. The confirmed implementation uses cookie mutation plus client `router.replace()`; a separate `router.refresh()` is only added if E2E demonstrates a need.
- **`router.replace` vs server `redirect()`.** A Server Action `redirect()` defaults to `push` (`redirect.md:31`). The confirmed implementation returns `{ ok: true }` and calls `router.replace("/login?loggedOut=1")` in the client hook.
- **"Protected pages send `Cache-Control: no-store`" is not true today.** Only redirect responses set it (`lib/auth/redirect-response.ts:16`, `session-expired/route.ts:20`). Honouring the note means adding it to protected responses (proxy headers for non-public paths, or `headers()` in `next.config.ts`) with a header test.
- **"Middleware guard"** = `proxy.ts` in this Next version (already built in Story 0.4).
- **Failure copy "You're still logged in on this device"** is conditional, not universal: show it only when the post-error check confirms authentication. Use generic confirmation copy when verification fails, and redirect when no session remains.
- **`loggedOut=1` is presentation-only.** `app/login/page.tsx` reads only `next` today; it must also read `loggedOut`. It must never affect authorization. Since it's user-typable, E2E must assert cookies/redirects, not the banner, as proof of logout.
- **No success alert variant.** `app/login/LoginAlert.tsx` has `LoginErrorAlert` and `LoginConfirmationRequiredAlert` (warning) only. `app/globals.css` defines `--danger-*` and warning tokens but **no `--success-*`, `--paper`, `--rail-text` or `--neutral-tint`** (verified by grep) that the wireframe CSS uses (`:770-795`, `:1323-1372`). Add them and register as `--color-*`. Use `role="status"` for the logged-out banner (informational), `role="alert"` for the failure.
- **Light bottom sheet is new.** Existing `SessionExpiryNoticeDialog` is a dark centered dialog; the wireframe sheet is a light "paper" sheet pinned to the bottom (`.modal-overlay` `align-items: flex-end`, `.modal-sheet` rounded top).
- **Email display:** `requireSession()` returns `claims` (`require-session.ts:13-17`), so `claims.email` is available without a DB call, but nothing passes it to a component yet. "Job Seeker" is static text.
- **Sheet a11y:** follow the dialog pattern (`role="dialog"`, `aria-modal`, `aria-labelledby`, focus first control, Escape closes, `useDialogKeyboardNavigation`), and return focus to the account button on close.
- **Overlay stacking:** `SessionExpiryNotice` is `fixed z-50`; the wireframe overlay is also `z-index: 50`. Decide behaviour if both are open.

### C. Supabase schema implications

All data tables in `Nextjoblog-supabase-schema.md` are per-user with RLS `auth.uid() = user_id`, and **none stores login state**, so log out needs **no schema change and no data deletion**.

- **Sessions:** `signOut({ scope: "local" })` revokes only the current row in `auth.sessions`; other devices stay logged in (meets "single-session only"). The default `global` scope would end them all.
- **`public.session_extensions`** (migration `20260917100000_create_session_extensions.sql`) is **missing from the schema doc**, which still lists only the original tables. It's keyed by `session_id` with `on delete cascade` from `auth.users` (not from `auth.sessions`), so after logout the row for that session is orphaned. This is harmless (session ids aren't reused; RLS limits visibility to the owner). Confirmed: leave it in place and document the behavior; do not delete it during logout.
- **RLS is the backstop for Back:** with no JWT the client is `anon`, `auth.uid()` is `NULL`, so every policy returns/permits nothing. The `security_invoker = true` analytics views are empty for anon too — worth one explicit test, since a plain view would bypass RLS.
- **Storage (future Feature 4):** `cv-documents` is private with owner-folder policies, but signed URLs issued before logout stay valid until expiry. Use short expiries and don't cache them across logout.
- **`profiles`:** holds `google_calendar_connected` and the encrypted refresh token. Logout must **not** touch the Google connection (account setting, not session).
- **Trigger** `on_auth_user_created` is insert-only; unaffected.

### D. Confirmed implementation decisions

7. **Navigation mechanism:** use typed action state plus client `router.replace("/login?loggedOut=1")`; do not use the default Server Action redirect behavior.
8. **`no-store` on protected responses:** implement it as an explicit task and add a response-header test.
9. **App shell scope:** build only the top bar with the Account button and sheet; the bottom nav is not required by any AC.
10. **Failure copy honesty:** show "still logged in" only if the post-error check verifies it; use generic copy when verification fails.
11. **Tokens/components:** add semantic success/paper tokens, `LoginLoggedOutAlert`, and the light bottom sheet.
12. **Schema doc housekeeping:** document `session_extensions` and that it is intentionally not cleaned up during logout.

### E. Test notes

- **Unit (action):** success calls `signOut({ scope: "local" })`; provider error → typed error + `logAuthEvent` with code/status only; `SupabaseConfigError` → configuration state.
- **Component:** button disabled/labelled while pending; failure alert `role="alert"`; Close restores focus; login page shows the banner only with `loggedOut=1` (`__tests__/login/`).
- **E2E** (`e2e/logout.spec.ts`, patterned on `route-guard.spec.ts`): log in → open sheet → Log Out → `toHaveURL(/\/login\?loggedOut=1$/)`; auth cookies gone (reuse `isAuthSessionCookie` from `e2e/session-expiry.spec.ts`); `page.goBack()` → `/login?next=%2Fdashboard`, no dashboard content; protected response has `cache-control: no-store`; a second context for the same user stays logged in (proves local scope); failure via `page.route("**/auth/v1/logout", r => r.abort())` exercises the selected post-error outcome, and retry succeeds once the route is removed.

---

## Follow-up Research: Project Structure, SOLID/Clean-Code Design, and ≥ 80 % Test Coverage

Sources: `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md` (the local copy of the Next.js project-structure guide), `vitest.config.mts`, and the existing `__tests__/`, `e2e/`, `components/`, `lib/auth/` layout.

### F. Where the code should live (Next.js project structure + Tailwind)

The local docs say Next is unopinionated but give three tools used elsewhere in this repo: **route groups** `(group)` (no URL effect), **private folders** `_folder` (opt out of routing, used for colocation) and **colocation** of non-routable files inside `app/`. The repo already applies them: protected UI lives in `app/(protected)/_components/`, server actions in `app/actions/`, pure domain logic in `lib/auth/` and `lib/session/`, shared presentational pieces in `components/auth/`. Follow the same convention rather than introducing `src/` or a new top-level folder.

Proposed layout (new files marked ★):

```
app/
  actions/
    auth.ts                      existing: signup / login  → add nothing here (see note)
    logout.ts                  ★ "use server": logout(_state) → LogoutState
    logout-messages.ts         ★ user-facing strings (mirrors session-messages.ts)
  (protected)/
    layout.tsx                   existing: mounts SessionExpiryNotice → also mounts AccountMenu
    _components/
      AccountMenu.tsx          ★ client: account icon button + open/close state
      AccountSheet.tsx         ★ client: dialog markup (avatar, email, Log Out, Close)
      LogoutAlert.tsx          ★ failure alert (or reuse LoginErrorAlert; see below)
      useLogout.ts             ★ hook: useActionState(logout) + navigate on success
      account-initial.ts       ★ pure: deriveAccountInitial(email)
  login/
    page.tsx                     existing → also reads `loggedOut`
    LoginAlert.tsx               existing → add LoginLoggedOutAlert
lib/
  auth/
    paths.ts                     existing → add LOGGED_OUT_PARAM_NAME, LOGGED_OUT_PARAM_VALUE, PROTECTED_CACHE_CONTROL
    login-redirect.ts            existing → add buildLoggedOutLoginUrl()
    sign-out.ts                ★ pure-ish core: signOutCurrentSession(client) → SignOutResult
    logout-outcome.ts          ★ pure: classifySignOutError(error) → "provider" | "network" | …
app/globals.css                  existing → add --success-tint / --success-fg / --paper tokens
__tests__/
  actions/logout.test.ts       ★
  lib/auth/sign-out.test.ts    ★
  lib/auth/logout-outcome.test.ts ★
  lib/auth/login-redirect.test.ts  (extend or add)
  protected/AccountMenu.test.tsx ★
  protected/AccountSheet.test.tsx ★
  protected/useLogout.test.tsx ★
  login/LoginPage.test.tsx / LoginAlert test ★
e2e/logout.spec.ts             ★
```

Notes:
- **Keep `auth.ts` out of it.** It already hosts signup + login (203 lines). A separate `logout.ts` keeps each action file single-purpose and lets the client hook import only what it needs.
- **Server Actions file must export only async functions** (`"use server"`), so types/constants/messages live in sibling non-action modules — the existing `session-messages.ts` shows this. `LogoutState` type can be `export type` (types are erased and allowed).
- **Tailwind v4 conventions in this repo:** utility strings grouped in a `styles` object per component (`SessionExpiryNoticeDialog.tsx:11-18`, `LoginForm.tsx:13-18`), colour tokens declared once in `app/globals.css` (`--danger-tint` → `--color-danger-tint`) and consumed as `bg-danger-tint`, never raw hex in components. Use the same pattern; add only semantic tokens (`success-tint`, `success-fg`, `paper`), no one-off arbitrary values besides the geometry already used elsewhere (`rounded-[10px]`, `min-h-11`).
- **Server vs Client boundary** (`05-server-and-client-components.md`): the layout stays a Server Component (it reads session expiry); only the interactive account menu/sheet are `"use client"`. Pass the email (a string) as a prop from the server side so no claims object crosses the boundary.
- **Placement in the layout, not the guard.** `docs/route-guard.md` forbids using the layout as the auth gate; rendering `AccountMenu` there is presentational and fine. The email prop comes from `getEffectiveSessionExpiry()`/claims already fetched there (layout `:9`) — extend that service's return type rather than a second `getClaims()` call (`cache()` already de-duplicates).

### G. SOLID / clean-code mapping

| Principle (from the request) | How the logout design satisfies it | Concrete rule for the plan |
|---|---|---|
| **Clean, readable, no magic numbers** | Names carry intent; every literal lives in `lib/auth/paths.ts` or `*-messages.ts`. | `"/login"`, `"loggedOut"`, `"1"`, the `no-store` header, button labels and error strings are constants, not inline. No nested ternaries in JSX; early returns in the action. |
| **Maintainability** | One reason to change per file. | Copy changes → `logout-messages.ts` only. Cookie/header policy → `paths.ts` only. Visual change → component `styles` object only. |
| **Extensibility (open/closed)** | Behaviour is added by composition, not by editing existing branches. | `SignOutResult` is a discriminated union; the action maps it with a lookup table so a future "sign out everywhere" (`scope: "global"`) is a new function/option, not an `if` in the existing one. `AccountSheet` takes `children`/`actions` slots so settings links can be added later without modifying it. |
| **Single responsibility** | Four layers: (1) provider call, (2) error classification, (3) action state mapping + redirect/logging, (4) UI. | `signOutCurrentSession` knows Supabase, nothing about Next. `classifySignOutError` knows error shapes, nothing about I/O. The action knows redirects/logging. Components know markup. |
| **Liskov / interface segregation** | Depend on the narrowest interface. | `signOutCurrentSession(client: Pick<SupabaseClient["auth"], "signOut" | "getClaims">)` — tests pass a 2-method fake, no `as unknown` casts. Components receive `email: string`, `onClose`, `pending`, `errorMessage?` — not the hook, not claims. |
| **Dependency inversion / testability** | Mirror `createRequireSession(deps)` (`lib/auth/require-session.ts:30`), which already injects `redirect`, `getRequestPath`, `now`. | `createLogout({ createClient, redirect, log })` factory + a default-wired `logout` export; tests call the factory with fakes, no module mocking of Next. Pure helpers (`deriveAccountInitial`, `classifySignOutError`, `buildLoggedOutLoginUrl`) take plain values and return plain values; no `Date.now()` / `process.env` reads inside. |
| **Reusability** | Small composable units. | `useLogout` is reusable by any future entry point (settings page). `AccountSheet` reuses `useDialogKeyboardNavigation` (existing) and `LoginErrorAlert` for the failure message (it is already shared with `SessionExpiryNoticeDialog`). `LoginLoggedOutAlert` sits beside the other alert variants. |
| **Accessibility** | Semantic HTML first, ARIA only where needed. | Account trigger: `<button type="button" aria-label="Account" aria-haspopup="dialog" aria-expanded>`. Sheet: `role="dialog" aria-modal="true" aria-labelledby`, initial focus on Log Out, Escape closes, Tab trap via the existing hook, focus returns to trigger. Failure `role="alert"`; logged-out banner `role="status"`. Pending: `aria-busy` + visible text change ("Logging out…"), never colour only. Touch target `min-h-11`; `focus-visible:ring-2`. Contrast: red-outlined button text uses `--danger-fg` (#8a271f) on paper — verify ≥ 4.5:1 (wireframe uses `--danger`, a lighter red; check before copying). Reduced motion: no animation required. |

Anti-patterns to avoid (explicitly called out in the request): calling `signOut()` from a component via the browser Supabase client (would bypass the server cookie bridge and the Server Action's logging); reading `window.location`/`navigator` inside pure helpers; `any`/`as` casts to satisfy mocks; a single 200-line component mixing trigger, sheet, state machine and strings.

### H. Test strategy and the ≥ 80 % coverage target

**What the repo already enforces** (`vitest.config.mts`): V8 coverage is on for every `vitest` run, with global thresholds **80 % lines/statements/functions/branches** and a stricter **90 %** for `lib/auth/**`. `proxy.ts`, `lib/supabase/server.ts` and `lib/auth/request-path.ts` are excluded. The new feature must therefore clear 80 % overall and any new file under `lib/auth/` must clear **90 %** — which is why the pure logic is deliberately placed there.

Caveats found in the config:
- No `coverage.include` is set, so files that no test imports are **not counted** and can silently drag nothing down. For this feature that means "coverage passed" is not evidence that `AccountMenu.tsx` is tested. Plan: either add `include: ["app/**", "components/**", "lib/**"]` (this will surface existing untested files — check the delta first) or assert per-file coverage for the new files in review (`npx vitest run --coverage --coverage.include=<new files>`).
- `app/**/page.tsx` and `layout.tsx` are async Server Components; existing tests call them as functions (`__tests__/dashboard/page.test.tsx`, `setup.test.tsx`). Do the same for the protected layout and login page changes rather than excluding them.

**Test matrix** (each row ties to an acceptance criterion in `change.md`):

| Layer | File | Cases | AC |
|---|---|---|---|
| Pure | `logout-outcome.test.ts` | auth API error 5xx → failure; `AuthRetryableFetchError` → network; 401/403/404 → treated as already-signed-out (matches auth-js); session-missing → success; unknown/thrown → failure | Happy, Error |
| Pure | `login-redirect.test.ts` | `buildLoggedOutLoginUrl()` === `/login?loggedOut=1`; no `next` ever emitted | Happy |
| Pure | `account-initial.test.ts` | normal email → uppercase first letter; empty/whitespace/non-letter → fallback glyph | UI |
| Service | `sign-out.test.ts` | calls `auth.signOut({ scope: "local" })` exactly once (**guards the global-scope regression**); returns success; returns failure on error; re-checks claims on failure and reports `still_signed_in` vs `signed_out` | Happy, Error |
| Action | `logout.test.ts` | success → redirect to logged-out URL **with replace**; provider error → `{ error: ... }` + log call with code/status only (assert no raw error object / no email in log args); `SupabaseConfigError` → configuration state; client factory throws → unknown state; redirect not swallowed by `try/catch` | Happy, Error |
| Hook | `useLogout.test.tsx` | idle → pending → error exposes message; retry re-invokes action; success triggers `router.replace` (not `push`); double invocation while pending is ignored; offline short-circuit does not dispatch the action and leaves retry available | Error |
| Component | `AccountSheet.test.tsx` | renders email + initial; Log Out button `disabled` + `aria-busy` while pending; error uses `role="alert"`; Escape/Close call `onClose`; focus lands on Log Out and returns to trigger; Tab wraps | a11y |
| Component | `AccountMenu.test.tsx` | trigger has accessible name "Account", `aria-expanded` toggles; sheet mounts/unmounts | a11y |
| Page | login page test | `loggedOut=1` → status banner; absent/other value → none; `next` still sanitised; banner never rendered with an `error` alert simultaneously | Happy |
| Layout | protected layout test | passes email to `AccountMenu` when authenticated; renders nothing extra when not | UI |
| Headers | `proxy`/headers test | protected response carries `Cache-Control: no-store` (excluded `proxy.ts` has an existing test file `__tests__/proxy.test.ts` — extend it; exclusion only affects the coverage number, not the test) | Edge (Back) |
| E2E | `e2e/logout.spec.ts` | the six scenarios listed in Section E | all |

Estimated outcome: the new `lib/auth/*` modules are tiny and branch-light, so 90 %+ is straightforward with the table above. UI files reach 80 %+ if each conditional render (pending / error / idle) has a test; the only realistically hard-to-cover lines are the `catch` branches around cookie-write failures, covered by the factory-injected fakes.

**Mocking conventions to follow** (consistent with existing suites):
- `vi.hoisted` + `vi.mock("@/lib/supabase/server")` for the Supabase client (`__tests__/actions/session.test.ts:3-23`).
- Mock `react`'s `useActionState` via `vi.importActual` spread for form components (`__tests__/login/LoginForm.test.tsx:4-12`) — or, preferably for the new hook, test with a real `useActionState` and an injected action to avoid mocking React itself.
- `cleanup()` in `beforeEach`; query by role/label (Testing Library), never by class name — this doubles as the a11y regression net.
- E2E: single worker, `test.describe.configure({ mode: "default" })`, unique `+${Date.now()}` emails, `npm run test:e2e` (starts via `scripts/run-e2e.mjs`, needs `supabase start`). CI runs Playwright via `.github/workflows/playwright.yml`; the unit/coverage gate runs through `npm run test:coverage`.

### I. Additional open items

13. **Coverage gate for new UI files** — adopt `coverage.include` or review-time per-file check (Section H caveat).
14. **Factory vs plain action** — confirm the `createLogout(deps)` shape (matches `createRequireSession`) is acceptable for a `"use server"` module: only the default-wired `logout` may be exported from the action file; the factory and `Deps` type must live in a non-`"use server"` module (e.g. `lib/auth/logout.ts`) because `"use server"` files can export only async functions.
15. **Contrast check** on the wireframe's red-outline button before adopting its colours.
16. **E2E in CI** — confirm the existing workflow provisions Supabase (it needs the local stack for signup/login); the logout spec reuses it, no new infra.
