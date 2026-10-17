---
date: 2026-10-16
researcher: Natta
git_commit: 493cee7
branch: fix/expired-session-local-sign-out
repository: nextjoblog
topic: "Fix expired-session cleanup scope (local sign-out)"
tags: [research, codebase, auth, session-expired, signout, supabase, proxy, e2e]
status: complete
last_updated: 2026-10-16
last_updated_by: Natta
---

# Research: Fix expired-session cleanup scope

## Research Question

`app/api/auth/session-expired/route.ts` ends the session with `supabase.auth.signOut()` (default **global** scope). What has to change so that an expired session ends only the *current* session, other devices stay signed in, redirect/`next` behaviour is unchanged, the route stops logging a raw error object, and the proxy's expired-cookie cleanup and this route do not duplicate each other? Source task: `context/changes/fix-expired-session-local-sign-out/change.md`, follow-up of `context/changes/log-out-of-the-app/` (research §"Housekeeping", decision 6).

## Summary

1. **The bug is real and security-relevant, and it fires on a valid JWT.** The route is reached only from `requireSession()` when the user is `authenticated` but `isSessionExpired(effectiveExpiresAt)` is true (`lib/auth/require-session.ts:43-45`). That is the *application-managed* expiry (`SESSION_TIMEBOX_MS` / 30-day lifetime + `session_extensions`). At that moment the GoTrue session and access token are still valid, so `signOut()` with the default `{ scope: 'global' }` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3405`) genuinely revokes **every** session of the user on all devices. This is exactly what `log-out-of-the-app` avoided for Log Out.
2. **The fix is a one-argument change**, plus tests/logging. `signOut({ scope: "local" })` in `_signOut` revokes only the session behind the presented access token and then calls `_removeSession()` (`GoTrueClient.js:3434-3441`), which clears the auth cookies through the route handler's cookie bridge (cookie writes work in Route Handlers; this is why the route exists).
3. **Proxy and route do not overlap in practice.** They are triggered by different expiry mechanisms (see "Redundancy analysis"). No code removal is needed; at most, add a comment, and optionally pin the distinction with a test.
4. **Error logging has two defects, not one:** the `catch` logs the raw error object (`route.ts:13`), *and* `signOut()` resolves with `{ error }` instead of throwing for provider failures, so today those failures are silently dropped (the `catch` never runs). Use the existing `logAuthEvent` (code/status only) for both.
5. **E2E for "other session still alive" does not need to wait for real expiry.** The route is public (`/api/auth` prefix) and does not itself verify expiry, so Playwright can call it with context A's cookies and then prove context B is untouched. A time-based variant is possible too (app lifetime is already 30 s in the Playwright web server).

## Detailed Findings

### 1. The route today — `app/api/auth/session-expired/route.ts:8-22`

```ts
try {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();                       // global scope
} catch (error) {
  console.error("Failed to sign out expired session:", error);   // raw error object
}
const next = resolvePostLoginPath(new URL(request.url).searchParams.get("next"));
const response = NextResponse.redirect(new URL(buildLoginRedirectUrl(next), request.url));
response.headers.set("Cache-Control", AUTH_REDIRECT_CACHE_CONTROL);
return response;
```

- Redirect target `/login?next=<sanitised>` and `Cache-Control: private, no-store, max-age=0` are independent of the sign-out call → unaffected by the fix. 307 status is the `NextResponse.redirect` default (asserted in the unit test).
- No `loggedOut=1` here, deliberately: this is an expiry, not a user-initiated logout (and the redirect is explicitly out of scope).
- Failure handling is "log and continue to login" — keep this. The user must always reach `/login`, even if the provider call fails.

### 2. Why scope matters here — auth-js semantics (`GoTrueClient.js:3405-3443`)

- `signOut(options = { scope: 'global' })`; `'local'` = current session only, `'others'` = all but current.
- `_signOut` first calls `admin.signOut(accessToken, scope)`. 401/403/404 and `AuthSessionMissingError` are swallowed (treated as already signed out); other errors still `removeCurrentSession()` (unless scope is `'others'`) and are returned as `{ error }` — **returned, not thrown**.
- Consequences for the route:
  - Success or swallowed error → local cookies removed (the "current session cleared" assertion holds).
  - A returned `{ error }` (5xx/network) → cookies are *also* removed locally, so the user is effectively signed out in this browser, but the server-side session row may survive. Acceptable for expiry cleanup (the session is expired by the app's own clock anyway); it just needs to be logged (finding 4).
  - A session-read error (`sessionError` that is not "session missing", `:3419-3421`) returns early **without** removing cookies. Then the browser keeps cookies → lands on `/login?next=…` still holding an app-expired session. Not a new risk (login is public, `requireSession` re-routes through this handler on the next protected visit, no loop), but worth a log line so it is visible.
- Cross-reference: `lib/auth/sign-out.ts` (`signOutCurrentSession`) already calls `signOut({ scope: "local" })` exactly once and extracts only `code`/`status`. It also re-checks claims after an error, which the expiry route does **not** need (it has nothing to show the user; it always redirects). Do not reuse the whole function — see "Design options".

### 3. Redundancy analysis: proxy cookie cleanup vs. this route

| | `proxy.ts:87-93` | `session-expired` route |
|---|---|---|
| Trigger | `getClaims()` returns GoTrue error `session_expired` → `classifyClaimsResult` → `unauthenticated/expired` (`lib/auth/session-state.ts:30-33`). The *provider* timebox/inactivity was exceeded; JWT can no longer be verified/refreshed. | `requireSession()` sees a **valid** session whose *application* `effectiveExpiresAt` is in the past (`require-session.ts:43`). |
| Session state at trigger | Already dead at the provider | Alive at the provider |
| What it does | Deletes chunk-like auth cookies from the response (`isChunkLike` over `getSupabaseAuthCookieStorageKey`). No network call to revoke. | Revokes (now: current session only) **and** clears cookies via the cookie bridge; redirects with `next`. |
| Follow-on | Falls through to `decideRouteAccess` → redirect to `/login?next=…` directly (never touches this route). | Redirect to `/login?next=…`. |

Findings:
- The two paths are **mutually exclusive per request**: provider-expired sessions are `unauthenticated` in `requireSession` (`:39-41`), so they redirect straight to `/login` and never reach the route; app-expired sessions are `authenticated` in the proxy, so the proxy deletes nothing. No redundant work, so **no refactor is required**. The only shared element is cookie removal, which is done by different mechanisms for different reasons.
- `/api/auth/session-expired` is a public path (`/api/auth` in `AUTH_PATH_PREFIXES`; asserted in `__tests__/lib/auth/logged-out-url.test.ts:24`), so the proxy lets the request reach the handler even when it considers the session `unauthenticated/expired` (e.g. someone hits the URL directly). In that case the proxy deletes the cookies on the pass-through response, and the route's `signOut` then finds no usable session and is a harmless no-op. That is the single benign overlap; both outcomes are the same (no cookies).
- The older research (`redirect-unauthenticated-users/research.md:173`) recorded the intended end-state: "sign-out handler remains for expired-session cleanup only". That is the current design; the fix stays within it.
- Recommended action for this item: document the distinction in a short comment (route + proxy), and verify with the existing tests. Do **not** delete either piece.

### 4. Error logging

- Current: `console.error("Failed to sign out expired session:", error)` logs the full error object (stack, response body, possibly request metadata).
- Project convention: `lib/auth/log.ts` `logAuthEvent(event, { code?, status? })` — "Never pass the raw error object". `lib/auth/messages.ts` holds `LOGOUT_LOG_EVENT` (event-name constants); `app/actions/auth.ts:12-19` has `AUTH_LOG_EVENT`. Add an expiry-route event constant next to those (do not inline a string).
- Proposed shape (illustrative, not final):
  ```ts
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) logAuthEvent(EXPIRED_SIGN_OUT_LOG_EVENT, { code: error.code, status: error.status });
  ...
  } catch (error) {
    // thrown: config error or unexpected → no raw object
    logAuthEvent(EXPIRED_SIGN_OUT_LOG_EVENT, error instanceof SupabaseConfigError ? { code: error.reason } : undefined);
  }
  ```
  `lib/auth/logout.ts` already has the exact mapping (`SupabaseConfigError` → `{ code: error.reason }`, unexpected → no details) — mirror it for consistency.
- Adjacent raw-error logs found (candidates, **not** part of this change unless the user widens scope): `lib/session/service.ts:56` (`console.error("Unable to read the effective session expiry", error)` — this one sits on the path that decides to redirect here) and `app/actions/session.ts:23`. `log-out-of-the-app/research.md` already flagged `session.ts:23`. Recommend recording them as a separate tiny follow-up rather than expanding this change.
- Test impact: spy on `console.error` and assert the logged args contain no `Error` instance (`expect.not.objectContaining`/check `args.every(a => !(a instanceof Error))`), and that a returned `{ error }` is logged with code/status only.

### 5. Unit tests — `__tests__/api/auth/session-expired.test.ts`

- Current assertion `expect(signOutMock).toHaveBeenCalledWith()` (line 28) must become `toHaveBeenCalledWith({ scope: "local" })`. Note `toHaveBeenCalledWith()` with no args will *fail* once the argument is added — the test is a genuine regression guard for the scope.
- Test title says "fully signs out the session" — rename (e.g. "signs out only the current session before redirecting…"), it is misleading after the change.
- Add cases (same file, same mocking style: `vi.hoisted` + `vi.mock("@/lib/supabase/server")`):
  - signOut resolves `{ error: { code, status } }` → still redirects with `next` and `Cache-Control`; logs code/status only.
  - signOut throws / `createServerSupabaseClient` rejects → still redirects; no raw `Error` passed to `console.error`.
  - `SupabaseConfigError` → logged `code: reason`, still redirects.
  - `signOut` called exactly once (`toHaveBeenCalledTimes(1)`).
- Coverage: the route is under `app/**` (global 80 % threshold); `lib/auth/**` additions need 90 %. A new constant in `lib/auth/messages.ts` is trivially covered.
- `__tests__/lib/auth/sign-out.test.ts` and `logout.test.ts` already guard the logout path's scope; no change there.

### 6. E2E coverage

Existing assets:
- `e2e/logout.spec.ts` — has `signUp(browser, label)`, `authCookieCount(page)` and the two-context test "logging out in one context leaves another context of the same user logged in" (lines ~58-80). That is the exact pattern to reuse for the "other session survives" assertion.
- `e2e/helpers/auth-cookies.ts` — `authCookieStorageKey()` / `isAuthSessionCookie()` (ignores PKCE verifier cookies; use it, don't `startsWith`).
- `e2e/session-expiry.spec.ts` — the "real session expiry (short timebox)" group swaps in `supabase-test` (30 s GoTrue timebox) and only asserts the cookie is cleared after reload. That test exercises the **proxy** path (provider expiry), *not* this route, so it does not cover this change; it should stay as is.
- `playwright.config.ts:24` starts Next with `SESSION_TIMEBOX_MS=30000 E2E_TEST_HOOKS=1`, so on the *default* local Supabase stack the **application** expiry is 30 s while the JWT/session stays valid — i.e. exactly the route's real trigger condition, reproducible without the stack swap.

Two viable designs (the plan should pick one; recommendation first):

| Option | How | Pros | Cons |
|---|---|---|---|
| **A (recommended): direct route call** | Two signed-in contexts (A, B) for the same user. `A.request.get("/api/auth/session-expired?next=%2Fdashboard%3Ftab%3Drecent", { maxRedirects: 0 })`; assert 307, `location` = `/login?next=%2Fdashboard%3Ftab%3Drecent`, `cache-control: private, no-store, max-age=0`, `Set-Cookie` deletes the auth cookies; `A` cookies gone; then B `reload()` → still `/dashboard`. Add an external-`next` case → `/login?next=%2Fdashboard`. | Fast, deterministic, no 30 s wait, works on default stack, no flake from timing. Tests the route's contract (it never inspects expiry). | Doesn't prove `requireSession` wires an expired session to the route (already unit-tested in `require-session.test.ts:35`). |
| **B: real app expiry** | Sign up A at t0; sign up/log in B; wait until A's app expiry (30 s after A's `amr` timestamp, see `sessionStartedAtMs` in session-expiry.spec.ts) while B must still be inside its own 30 s window (or extend B via the notice dialog); `A.page.goto("/dashboard")` → lands on `/login?next=%2Fdashboard`, cookies cleared; B reload OK. | Full end-to-end wiring including `requireSession` → route. | ~30 s test, tight timing window for B (B starts after A, so B outlives A by its start offset), higher flake risk; CI retries mask failures. |

Recommendation: A for the scope/isolation assertions (primary), plus keep one B-style test only if the plan wants wiring proof; the wiring is already covered at unit level.

Precision note for assertions: "other session still usable" should be checked at the **server**, not just the browser — e.g. B `page.reload()` expecting `/dashboard`, and/or `fetch(`${SUPABASE_URL}/auth/v1/user`, { Authorization: Bearer <B access token> })` returning 200 (the pattern `decodeAuthCookie` in `session-expiry.spec.ts` already extracts tokens). With the old global scope, B's token would receive 403 `session_not_found`/401, so this assertion **fails before the fix** and passes after — it is a real regression test, not a tautology. Verify that "fails before the fix" claim by running the new spec against the unfixed route first (CI-only today: local Chromium is unsupported on macOS 13 per `log-out-of-the-app/plan-brief.md:55`; if E2E can't run locally, state that in the plan's verification section).

Where to put it: `e2e/session-expiry.spec.ts` is already ~290 lines and has a destructive beforeAll/afterAll swap in one group; a new `test.describe` in `e2e/logout.spec.ts` would be misleading (not a logout). Prefer a new small spec, e.g. `e2e/session-expired-route.spec.ts`, reusing the helpers (extract `signUp`/`authCookieCount` if duplicating them becomes noisy; `logout.spec.ts` defines them locally).

### 7. Other call sites / blast radius

- Only caller of the route: `requireSession()` via `buildSessionExpiredUrl` (`lib/auth/login-redirect.ts:20`, `lib/auth/paths.ts` `SESSION_EXPIRED_PATH`). No client code, no tests other than `__tests__/api/auth/session-expired.test.ts` and `__tests__/lib/auth/require-session.test.ts:35-38` (checks only the redirect URL — unaffected).
- The route is a **GET with a state-changing side effect** and is public. Under global scope any third-party page could do `<img src="https://app/api/auth/session-expired">` and sign a victim out of **all** devices; under local scope the damage shrinks to the one browser's session. Worth recording as residual risk (it remains a logout-CSRF / forced-logout vector for the current browser). Changing the method to POST or validating expiry server-side is **out of scope** (would change the redirect flow) — note it for the backlog, don't fix here.
- `session_extensions`: the row for the ended session is left in place (consistent with the logout decision; out of scope per the task).
- Docs: `docs/route-guard.md:11` describes Log Out's local scope; it does not mention the expiry route. A one-sentence addition ("expiry cleanup is also local-scope") keeps the doc truthful. Check `docs/` has no statement that expiry signs the user out everywhere (grep found none).

## Code References

- `app/api/auth/session-expired/route.ts:8-22` — the global `signOut()` and raw error log to change
- `__tests__/api/auth/session-expired.test.ts:28` — `toHaveBeenCalledWith()` to update; title at `:24`
- `lib/auth/require-session.ts:39-45` — only trigger of the route (valid session, app-expired)
- `lib/auth/login-redirect.ts:20`, `lib/auth/paths.ts` — `buildSessionExpiredUrl`, `SESSION_EXPIRED_PATH`, `AUTH_REDIRECT_CACHE_CONTROL`
- `proxy.ts:87-93` — provider-expired cookie cleanup (different trigger)
- `lib/auth/session-state.ts:30-33` — `session_expired` → `unauthenticated/expired`
- `lib/auth/sign-out.ts`, `lib/auth/logout.ts`, `lib/auth/log.ts`, `lib/auth/messages.ts` — scope + safe-logging patterns to mirror
- `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3405-3443` — default scope and error/cookie semantics
- `e2e/logout.spec.ts` (two-context test), `e2e/helpers/auth-cookies.ts`, `e2e/session-expiry.spec.ts` (decodeAuthCookie, proxy-path test), `playwright.config.ts:24` — E2E building blocks

## Architecture Insights

- Mutating auth cookies must stay in a response context (Route Handler) — which is why the expiry route exists and must keep existing; the fix does not change that.
- Two expiry notions coexist: provider (GoTrue timebox, handled in `proxy.ts`) and application (`session_extensions`, handled by `requireSession` → this route). Keeping them distinct is the reason there is no real duplication.
- Safe-logging contract: only `code`/`status` via `logAuthEvent`; any new event name belongs in `lib/auth/messages.ts` as a constant.

## Open Questions / Decisions for planning

1. **Reuse vs. minimal edit — decided: inline in the route.** Call `signOut({ scope: "local" })` directly in `app/api/auth/session-expired/route.ts`. Do not reuse `signOutCurrentSession` or add a new abstraction because its post-error `getClaims()` check is unnecessary for this redirect-only route and would add a network call to every expiry redirect.
2. **Log event name — decided: add a new constant.** Add `EXPIRED_SESSION_LOG_EVENT` in `lib/auth/messages.ts` and send failures through `logAuthEvent`. A dedicated event keeps automatic expiry cleanup distinguishable from user-initiated logout in logs and metrics.
3. **E2E design — decided: direct route call as the primary test.** Sign in two contexts for the same user, call the expiry route from context A, and verify that A is signed out while context B remains usable. This is deterministic, fast, and directly verifies local-session isolation. A real 30-second expiry test is not required because the route wiring is already covered by unit tests.
4. **E2E file placement — decided: create `e2e/session-expired-route.spec.ts`.** Keep this route contract separate from user-initiated logout tests and provider-expiry tests.
5. **Raw-error logs elsewhere — decided: defer to a separate follow-up.** Fix raw-error handling in this expiry route only. Track `lib/session/service.ts:56` and `app/actions/session.ts:23` in a separate follow-up named **Harden remaining auth/session error logging**.
6. **Documentation — decided: add one sentence.** Update `docs/route-guard.md` to state that expired-session cleanup uses local scope and leaves sessions on other devices active. This documents the security boundary and helps prevent regression to global scope.
7. **Priority — decided: high.** Record the change as **high** priority because the current implementation can revoke every valid session on every device through an unauthenticated `GET` request. It is a security-relevant forced-logout issue, even though it does not expose data or directly compromise an account.

## Out of scope (confirmed by the task)

Logout button behaviour, new UI, post-logout redirect, session schema changes, deleting `session_extensions` on expiry, switching the route to POST / server-side expiry verification, and Story 0.5 work.
