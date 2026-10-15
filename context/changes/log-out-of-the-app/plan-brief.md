# Log Out of the App — Plan Brief

> Full plan: `context/changes/log-out-of-the-app/plan.md`
> Research: `context/changes/log-out-of-the-app/research.md`

## What & Why

A logged-in Job Seeker can end their session from an Account sheet so nobody else can use a shared device (Story 0.5). Only the current session is ended; failures never leave an ambiguous or misleading state.

## Starting Point

No logout feature, no top bar, and no success alert exist. The only `signOut()` uses the default global scope. Story 0.4's proxy + `requireSession()` already redirect logged-out users, but protected pages don't send `no-store`.

## Desired End State

Account button → bottom sheet → Log Out → `/login?loggedOut=1` with a success banner. Back never shows a protected page. Failure re-checks the session: redirect if gone, "still logged in" + Try Again if valid, generic error + Try Again if unverifiable. Offline never dispatches the action.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | `signOut({ scope: "local" })` | Story excludes all-device logout | Research |
| Navigation | Action returns typed state; client `router.replace`; Phase 2 spike gate confirms the action re-render does not race it (fallback: Route Handler/`fetch`) | Action `redirect()` uses push | Research, Plan review |
| Failure handling | Re-check claims after any error | auth-js may clear cookies before returning an error | Research |
| Control placement | Top bar + Account sheet in protected layout (presentational) | Every page gets it; layout is not the guard | Research |
| Back button | `replace` + `no-store` on protected responses + existing guard; E2E-proven | Router cache/bfcache can replay pages | Research |
| Offline | `navigator.onLine` guard, no auto-retry | Same as `useSessionExtension` | Research |
| Expired-session route | Unchanged here; follow-up `fix-expired-session-local-sign-out` | Keeps this story focused | Research |
| Structure | `lib/auth/{sign-out,logout}.ts` pure + DI factory; thin `"use server"` action; shared helpers extracted (`isPublicPath` export, `lib/auth/log.ts`, shared offline message) | 90% gate, testable without mocking Next | Plan |
| E2E failure forcing | Production-inert `e2e-logout` cookie hook (`E2E_TEST_HOOKS=1`) | `page.route` cannot see the server-side `signOut` | Plan review |
| Modal ownership | Sheet closes while the expiry notice is open | Avoid two `aria-modal` dialogs/focus traps | Plan review |

## Scope

**In scope:** logout action + core, hook, E2E failure test hook, top bar/Account sheet, success tokens + login banner, `no-store` on protected responses (baseline `curl -I` first), unit + E2E tests, docs.

**Out of scope:** all-device logout, bottom nav, confirmation step, session-expired route fix, `session_extensions` cleanup, Google connection changes, logout control on the `verification_failed` screen.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure core | sign-out service, orchestration, constants | Wrong post-error classification |
| 2. Action + hook | `logout` action, `useLogout`, E2E hook, spike gate | Re-render race with `router.replace`; `use server` export rules; double fire after success |
| 3. UI | Tokens, top bar, sheet | a11y, contrast, z-index vs expiry notice |
| 4. Login + no-store | Baseline check, banner, protected cache header | Header lost on `setAll` rebuild |
| 5. E2E + docs | Playwright spec (hook-driven failures), shared cookie helper, docs, follow-up change | Hook cookie leaking between scenarios |

**Prerequisites:** Stories 0.2 and 0.4 (done); local Supabase for E2E.
**Estimated effort:** ~3-5 sessions across 5 phases.

## Open Risks & Assumptions

- Unverified: the action's cookie-mutation re-render may redirect to `/login?next=…` before `replace` lands; the Phase 2 spike gate must pass before UI work. Add `router.refresh()` only if E2E proves it necessary.
- Protected responses may already send `no-store`; Phase 4 verifies the baseline first.
- Coverage gate does not count untested UI files; per-file coverage is reviewed manually.
- Wireframe red-outline contrast must be verified before adopting colours.
- Vercel header behaviour is confirmed only after deploy.

## Success Criteria (Summary)

- Every acceptance criterion has a passing automated test, E2E green on GitHub Actions (failure branches driven by the test hook).
- Coverage ≥ 80% overall, ≥ 90% for `lib/auth/**`.
- Other sessions of the same user stay active; no failure path claims a state it hasn't verified.
