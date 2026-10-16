# Log Out of the App — Plan Brief

> Full plan: `context/changes/log-out-of-the-app/plan.md`
> Research: `context/changes/log-out-of-the-app/research.md`

## What & Why

A logged-in Job Seeker can end their session from an Account sheet (mobile) or an inline Log Out (desktop) so nobody else can use a shared device (Story 0.5). Only the current session is ended; failures never leave an ambiguous or misleading state.

## Starting Point

No logout feature, no top bar, and no success alert exist. The only `signOut()` uses the default global scope. Story 0.4's proxy + `requireSession()` already redirect logged-out users, but protected pages don't send `no-store`.

## Desired End State

Account button → bottom sheet → Log Out → full-page navigation to `/login?loggedOut=1` with a success banner. Back never shows a protected page. Failure re-checks the session: redirect if gone, "still logged in" + Try Again if valid, generic error + Try Again if unverifiable. Offline never sends the request.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | `signOut({ scope: "local" })` | Story excludes all-device logout | Research |
| Navigation | `POST /api/auth/logout` Route Handler returns typed JSON; client `window.location.replace` | Spike FAILED: a Server Action's re-render raced `router.replace`; `router.replace` also let Back show a Next client-cache page | Spike, E2E |
| Failure handling | Re-check claims after any error | auth-js may clear cookies before returning an error | Research |
| Control placement | Top bar in protected layout; one `useLogout` owned by always-mounted `AccountControls`, passed as props to presentational `AccountSheet` / `LogoutButton` | Every page gets it; layout is not the guard; an in-flight logout survives closing the sheet | Research, Impl review |
| Back button | `no-store` on protected responses + existing guard + `AuthHistoryGuard` (one inline script reloading non-public pages restored by `pageshow`/`popstate`); E2E-proven | Router cache/bfcache can replay pages | Research, E2E |
| Offline | `navigator.onLine` guard, no auto-retry | Same as `useSessionExtension` | Research |
| Expired-session route | Unchanged here; follow-up `fix-expired-session-local-sign-out` | Keeps this story focused | Research |
| Structure | `lib/auth/{sign-out,logout,logout-state}.ts` pure + DI factory; thin Route Handler; shared helpers (`isPublicPath` export, `lib/auth/log.ts`, all copy in `lib/auth/messages.ts`) | 90% gate, testable without mocking Next, `lib/` never imports `app/` | Plan, Impl review |
| E2E failure forcing | Production-inert `e2e-logout` cookie hook (`E2E_TEST_HOOKS=1`) | `page.route` cannot see the server-side `signOut` | Plan review |
| Modal ownership | Sheet closes while the expiry notice is open | Avoid two `aria-modal` dialogs/focus traps | Plan review |

## Scope

**In scope:** logout Route Handler + core, hook, E2E failure test hook, top bar/Account sheet, success tokens + login banner, `no-store` on protected responses (baseline `curl -I` first), unit + E2E tests, docs.

**Out of scope:** all-device logout, bottom nav, confirmation step, session-expired route fix, `session_extensions` cleanup, Google connection changes, logout control on the `verification_failed` screen.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure core | sign-out service, orchestration, constants | Wrong post-error classification |
| 2. Route + hook | `POST /api/auth/logout`, `useLogout`, E2E hook, spike gate (failed for the action, passed for the route) | Re-render race (resolved by Route Handler); double fire after success |
| 3. UI | Tokens, top bar, `AccountControls`, sheet, desktop inline button | a11y, contrast, z-index vs expiry notice, closing sheet mid-request |
| 4. Login + no-store | Baseline check, banner, protected cache header | Header lost on `setAll` rebuild |
| 5. E2E + docs | Playwright spec (hook-driven failures), shared cookie helper, docs, follow-up change | Hook cookie leaking between scenarios |

**Prerequisites:** Stories 0.2 and 0.4 (done); local Supabase for E2E.
**Estimated effort:** ~3-5 sessions across 5 phases.

## Open Risks & Assumptions

- Resolved: the Server Action re-render raced the client redirect (spike failed); the Route Handler plus full-page navigation fixed it.
- E2E runs only in GitHub Actions (Chromium cannot be installed on the local macOS 13); local verification is unit tests, `tsc` and lint.
- Protected responses may already send `no-store`; Phase 4 verifies the baseline first.
- Coverage gate does not count untested UI files; per-file coverage is reviewed manually.
- Wireframe red-outline contrast must be verified before adopting colours.
- Vercel header behaviour is confirmed only after deploy.

## Success Criteria (Summary)

- Every acceptance criterion has a passing automated test, E2E green on GitHub Actions (failure branches driven by the test hook).
- Coverage ≥ 80% overall, ≥ 90% for `lib/auth/**`.
- Other sessions of the same user stay active; no failure path claims a state it hasn't verified.
