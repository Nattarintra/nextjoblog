---
date: 2026-09-07T21:30:58+02:00
researcher: Natta
git_commit: a231aa312d23fec519495ea54531f6fe47660882
branch: feat/log-in-to-an-existing-account
repository: nextjoblog
topic: "Log in to an existing account"
tags: [research, auth, supabase, login, signin, server-actions, proxy, rls]
status: complete
last_updated: 2026-09-07
last_updated_by: Natta
last_updated_note: "GitHub issues created after the initial pass (confirmed verbatim match, resolved Open Question #1 via issue #6); Natta then confirmed the 0.2-vs-0.4 scope boundary directly, and Open Question #2 was dug into and confirmed as an intentional planning-time copy decision"
---

# Research: Log in to an existing account

**Date**: 2026-09-07T21:30:58+02:00
**Researcher**: Natta
**Git Commit**: a231aa312d23fec519495ea54531f6fe47660882
**Branch**: feat/log-in-to-an-existing-account
**Repository**: nextjoblog

## Research Question

As a Job Seeker, I want to log in with my email and password, so that I can access my saved application data. (Task issue, dependent on Story 0.1 — Sign Up for a New Account, which is already merged to `main` via PR #1.)

Parent Story 0 (Account Setup & Data Foundation) and the task issue text were supplied directly in the invocation. At the time research began, a check of `github.com/Nattarintra/nextjoblog/issues` returned zero issues, so the pasted text was treated as the authoritative source. The issues were created shortly afterward — see Follow-up Research below for the now-live GitHub issue numbers and a confirmation that their content matches the originally pasted text verbatim.

## Summary

All auth infrastructure this task needs already exists and was built for the sign-up story (merged: `b86a39e`, PR #1). The login feature is a **near-mechanical mirror of the sign-up vertical slice**: same `proxy.ts` session-refresh guard, same `lib/supabase/server.ts` client factory, same Server-Action-plus-`useActionState`-Client-Component pattern, same Tailwind v4 design-token approach, same Vitest/Playwright test setup. Nothing new needs to be installed.

The one piece of genuinely new backend knowledge is the Supabase Auth error contract for `signInWithPassword`: GoTrue returns the **same** `invalid_credentials` error code/message whether the email doesn't exist or the password is wrong, and the `@supabase/auth-js` client does no special-casing or email-casing normalization itself — both of these properties line up exactly with what the AC requires (a generic "Email or password is incorrect" message, and case-insensitive login), but the case-insensitivity is entirely a server/Postgres-side guarantee, not something the client code produces.

Two things are explicitly **not** covered by this task's AC: (1) redirecting unauthenticated users away from protected routes — confirmed via GitHub issue #6 to be its own separate story (Story 0.4), which depends on this task rather than the other way around, so `proxy.ts` should gain no route-guard logic here; and (2) `/dashboard` does not exist yet (same state as when sign-up was built; sign-up already redirects there and accepts the resulting 404).

## Detailed Findings

### Design — Login screen (`scr-login`)

Source: `supabase/docs/nextjoblog-mvp-screens.html:1250–1283`

- Template ID: `scr-login`, nav caption (line 2125): _"Dark, control-room entry point before the light-mode app. Shows the generic invalid-credential message that avoids confirming which field was wrong."_
- Same device frame / `.auth-wrap` / `.auth-glow` / `.auth-mark` structure as `scr-signup` (identical logo SVG, identical wrapper classes) — this is the same component shell used across all three auth screens (login, signup, forgot).

**Elements in DOM order** (`nextjoblog-mvp-screens.html:1250–1283`):

| Element | HTML | Notes |
|---|---|---|
| Logo mark | `<div class="auth-mark">` SVG 40×40 | Identical SVG to `scr-signup`; already extracted as the reusable `Logo` component (`components/Logo.tsx`) |
| Heading | `<div class="auth-h1">Log In</div>` | |
| Subtitle | `<div class="auth-sub">Log your job applications and track every step in one place.</div>` | |
| Error alert (invalid-credentials state) | `<div class="alert alert-danger" style="margin-bottom: 16px">` | Circle-with-exclamation SVG icon (different icon than the signup triangle-warning icon); text: _"Email or password is incorrect"_ — matches the AC's exact wording |
| Email field | `<div class="auth-field">` / `<input type="email" placeholder="you@example.com">` | Label "Email" — identical markup/classes to signup's email field |
| Password field | `<div class="auth-field">` / `<input type="password" placeholder="••••••••">` | Label "Password" — **no helper text below it** in the login template (unlike signup's "At least 6 characters"), because login doesn't validate password shape, only checks credentials |
| Forgot-password link | `<div style="text-align: right; margin-bottom: 20px"><span class="auth-link" data-goto="scr-forgot">Forgot password?</span></div>` | Right-aligned, above the submit button; the `scr-forgot` destination route (`/forgot-password` or similar) is a separate story, out of scope here — link target will 404 for now, same pattern as signup's `/login` link before this task existed |
| Submit | `<button class="btn btn-primary">Log In</button>` | Same `.btn.btn-primary` styling as signup's "Sign Up" button |
| Footer | `<div class="auth-foot">Don't have an account? <span class="auth-link" data-goto="scr-signup">Sign Up</span></div>` | Mirrors signup's footer, pointing back to `/signup` |

**New color token needed**: the login alert uses `.alert-danger`, which is **not yet defined** as a Tailwind theme token in `app/globals.css` (only `--warning-tint`/`--warning-fg` exist, added for the signup duplicate-email alert). The mockup CSS (`nextjoblog-mvp-screens.html:23-24,723-726`) defines:
```css
--danger: #c0362c;
--danger-tint: #fbe9e7;
.alert-danger { background: var(--danger-tint); color: #8a271f; }
```
Following the existing `--warning-tint`/`--warning-fg` naming pattern already in `app/globals.css:9-10`, this task will need to add `--danger-tint: #fbe9e7` and a `--danger-fg: #8a271f` pair (the signup component already separately defines `--auth-danger: #ffb4ab` at `app/globals.css:12` for its own inline validation-error text color — that token is a different color and a different purpose; the login alert background/foreground pair is new).

### Codebase — reusable auth infrastructure (built for sign-up, directly reusable)

- `proxy.ts` (project root, 43 lines) — session-refresh guard. Creates a `createServerClient` from request cookies, calls `supabase.auth.getClaims()`, returns `NextResponse.next()`. **Confirmed: contains zero route-guarding/redirect logic** — every route is currently reachable regardless of auth state. No changes needed for this task's stated AC (which doesn't include the "redirect unauthenticated users" edge case — see Open Questions).
- `lib/supabase/server.ts` — `createServerSupabaseClient()` factory using `getAll`/`setAll` cookie methods, exactly what a new `login` Server Action would call.
- `app/actions/auth.ts` — existing `signup` Server Action. Pattern to mirror:
  - File-level `"use server"`.
  - `isAuthApiError` from `@supabase/auth-js` used as the type guard for Supabase error branching — confirmed still correct for `signInWithPassword` errors (see Supabase Auth API findings below; no more specific error subclass exists for invalid-credentials).
  - Discriminated-union `FormState` type, trimmed/typed `FormData` extraction, validation before any network call, `redirect()` called **unconditionally after** the try/catch (never inside it, since `redirect()` throws a `NEXT_REDIRECT` control-flow exception that a catch block would swallow).
- `app/signup/` — full component decomposition to mirror: `page.tsx` (loads `Archivo`/`Work_Sans` fonts, dark navy wrapper), `SignupForm.tsx` (client component, `useActionState`), `SignupFields.tsx`, `PasswordField.tsx`, `SignupAlerts.tsx`, `styles.ts` (shared `authInputClassName`/`authFieldLabelClassName`/`authLinkClassName` — directly reusable, no need to redefine for login), `password-validation.ts` (not needed for login — login doesn't validate password shape client-side, only that both fields are non-empty via `required`).
- `components/Logo.tsx` — shared logo SVG, reusable as-is.
- Test infra already installed and configured: Vitest (`vitest.config.mts`, jsdom, `__tests__/**/*.test.{ts,tsx}`), React Testing Library, Playwright (`playwright.config.ts`, `testDir: './e2e'`, auto-starts `npm run dev`). No new dependencies to install.
- `__tests__/signup/SignupForm.test.tsx` and `e2e/signup.spec.ts` are the direct structural templates for the new login tests (mocking `useActionState` via `vi.hoisted`, mocking `next/link`, asserting on `getByLabelText`/`getByRole`; E2E using `page.getByLabel(...)`, seeded-user `beforeAll` pattern, `test.describe.configure({ mode: "default" })` to avoid parallel-worker races when a fixed seed account is reused across test cases).

### Supabase Auth API — `signInWithPassword` (new research, not covered by the prior sign-up research doc)

Source: `node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:589`, `node_modules/@supabase/auth-js/src/GoTrueClient.ts:1226-1242`, `node_modules/@supabase/auth-js/src/lib/types.ts:257-262,291-295,675-683`

- `supabase.auth.signInWithPassword({ email, password })` returns `Promise<AuthTokenResponsePassword>`, a discriminated union: `{ data: { user, session, weakPassword? }, error: null } | { data: {...nulls}, error: AuthError }`.
- **Invalid-credentials error is unified.** `'invalid_credentials'` is a real `ErrorCode` (`node_modules/@supabase/auth-js/src/lib/error-codes.ts:88`). GoTrue's server returns this same code/message whether the email doesn't exist or the password is wrong — the `auth-js` client applies no special-casing (`handleError` in `src/lib/fetch.ts:79-146` just reads `data.code`/`data.error_code` off the server response and throws a generic `AuthApiError`). **This means the AC's anti-enumeration requirement is satisfied for free by Supabase's own error contract** — the app just needs to map any `invalid_credentials`-coded (or generically-failed) sign-in to the fixed string "Email or password is incorrect" without inspecting which field was wrong.
- `isAuthApiError` (`src/lib/errors.ts:70-72`) — the same type guard already imported in `app/actions/auth.ts` for the signup action — is confirmed correct for `signInWithPassword` errors too. No more specific error subclass exists for invalid-login-credential handling (the only related specialized subclasses are `AuthWeakPasswordError` and `AuthSessionMissingError`, neither applicable here).
- **Case-insensitive email matching is NOT done by the client.** No `.toLowerCase()` or email normalization exists anywhere in `signInWithPassword` or `signUp` in the `auth-js` source tree (confirmed via full-tree search — the only `toLowerCase()` call in the package is unrelated, on an Ethereum address in `src/lib/web3/ethereum.ts:96`). The AC's case-insensitive-login requirement (`User@Example.com` vs `user@example.com`) is therefore **entirely a server-side (GoTrue/Postgres) guarantee** — Supabase Auth's `auth.users.email` lookup is case-insensitive on the server, but the app should not add its own `.toLowerCase()` unless a real case-sensitivity bug is observed, since doing so would diverge from the server's actual matching behavior.
- Supabase's built-in rate limiting already covers repeated sign-in attempts at the infrastructure level: `supabase/config.toml:206`, `sign_in_sign_ups = 30` under `[auth.rate_limit]` (line 196). This task's AC doesn't require app-level rate limiting (that requirement lives in the parent Story 0's password-reset NFR, a separate story) — the existing Supabase config setting already applies to `signInWithPassword` calls with no code change needed.
- `'over_request_rate_limit'` (`error-codes.ts:71`) is the code surfaced if that limit is hit — worth knowing as a possible (though not AC-mandated) third error state, distinct from `invalid_credentials`.
- **Correction during research**: an initial pass reported `.github/workflows/playwright.yml` as missing — that was checked from the wrong directory. The actual git repository root is `/Users/natta/Desktop/Nextjs` (one level *above* this Next.js app, which lives in the `nextjoblog/` subdirectory: `git rev-parse --show-toplevel` confirms this, and `git ls-tree -r HEAD` from the repo root lists `.github/workflows/playwright.yml` as tracked). The workflow file exists, runs on every push/PR/workflow_dispatch to any branch, sets `working-directory: nextjoblog` for all steps, starts a local Supabase instance, resets the DB, exports `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` from `supabase status`, and runs `npm run test:e2e`. A new `e2e/login.spec.ts` will run in this same CI job automatically — no workflow changes needed.

### Route protection — NOT covered by this task's AC (flagged, not assumed)

Source: `proxy.ts` (full file, 43 lines); repo-wide grep for `getUser(`, `NextResponse.redirect`, `notFound(`, `unauthorized`

- `proxy.ts` has no auth-guard logic today — confirmed via full-file read and a repo-wide grep (excluding `node_modules`/`test-results`) that found no redirect/guard patterns anywhere except plain `<Link href="/login">` UI navigation in the signup component and its test.
- `app/dashboard/` does not exist (only a stale Playwright test-results artifact directory name references it).
- Next.js 16's own docs describe the recommended pattern for this, if/when it's needed: `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1026-1077` ("Optimistic checks with Proxy") — define `protectedRoutes`/`publicRoutes` arrays, read the session in `proxy.ts`, and call `NextResponse.redirect(new URL('/login', req.nextUrl))` for an unauthenticated user hitting a protected route (and the reverse for an authenticated user hitting `/login`/`/signup`). The docs explicitly caveat (line 1121) that Proxy-level checks are "optimistic" only and real authorization must also happen at the data layer — which this app already gets for free via Postgres RLS on every table.
- **This task's own AC (Happy Path / Edge Cases / Error Handling / Non-Functional, as given in the task issue) does not mention redirecting unauthenticated users away from protected routes** — that specific edge case belongs to the parent Story 0 AC, not to this task issue. Since `/dashboard` doesn't exist yet anyway, there is nothing concrete to guard right now. See Open Questions.

### Historical context (from `context/changes/sign-up-for-a-new-account/`)

- `plan.md` — full 4-phase implementation plan for signup (Vitest setup → auth infra → Server Action → UI → Playwright E2E), all phases complete and reviewed. Reused wholesale as the structural template for a login plan, minus Phase 0/1 (already done) and the Playwright-install sub-step (already done).
- `reviews/impl-review.md` — 5 findings, all fixed. Relevant lessons for the login plan:
  - **F1**: keep plan/research in sync with the actual DB architecture (the profiles-trigger, not an app-level insert) — not directly applicable to login (no profile creation happens at login), but the general lesson of keeping docs synced with implementation holds.
  - **F5**: "Server-side email validation accepts malformed addresses" — the signup action's email regex (`app/actions/auth.ts:35`) is a minimal shape check added specifically because Supabase itself doesn't reject clearly-malformed strings before hitting the network. The same consideration applies to a login action, though arguably less critical since a malformed email will simply fail to match any account and surface as `invalid_credentials` (the correct generic message) rather than a distinct error.
- `reviews/plan-review.md` — confirms `getClaims()`, `useActionState` import source, and the `redirect()`-outside-try/catch pitfall were all independently verified against source in the prior story; those same facts apply unchanged to a login action.

## Code References

- `supabase/docs/nextjoblog-mvp-screens.html:1250-1283` — `scr-login` template (form HTML)
- `supabase/docs/nextjoblog-mvp-screens.html:23-24,723-726` — `.alert-danger` styling and `--danger`/`--danger-tint` tokens (not yet ported to `app/globals.css`)
- `supabase/docs/nextjoblog-mvp-screens.html:2125` — nav JS caption for `scr-login`
- `app/globals.css:1-41` — current Tailwind v4 theme tokens (`--warning-tint`/`--warning-fg`/`--auth-danger` exist; `--danger-tint`/`--danger-fg` do not yet)
- `proxy.ts:1-43` — session-refresh guard, no auth-guard logic
- `lib/supabase/server.ts:1-28` — `createServerSupabaseClient` factory, reusable as-is
- `app/actions/auth.ts:1-79` — `signup` Server Action, structural template for a `login` action
- `app/signup/SignupForm.tsx`, `SignupFields.tsx`, `PasswordField.tsx`, `SignupAlerts.tsx`, `AuthLogo.tsx`, `styles.ts`, `page.tsx` — component decomposition template
- `components/Logo.tsx` — shared logo SVG component
- `__tests__/signup/SignupForm.test.tsx` — unit test template
- `e2e/signup.spec.ts` — E2E test template (seeded-user pattern, `test.describe.configure({ mode: "default" })`)
- `playwright.config.ts`, `vitest.config.mts` — existing test tooling config, no changes needed
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:589` — `signInWithPassword` type signature
- `node_modules/@supabase/auth-js/src/GoTrueClient.ts:1226-1242` — `signInWithPassword` implementation
- `node_modules/@supabase/auth-js/src/lib/error-codes.ts:71,88` — `over_request_rate_limit`, `invalid_credentials` error codes
- `node_modules/@supabase/auth-js/src/lib/fetch.ts:79-146` — generic `handleError`, confirms no wrong-password-vs-no-such-user branching
- `node_modules/@supabase/auth-js/src/lib/errors.ts:70-72` — `isAuthApiError` type guard definition
- `supabase/config.toml:180-184,196,206,218,225` — `minimum_password_length`, `[auth.rate_limit]` (`sign_in_sign_ups = 30`), `enable_confirmations = false`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1026-1077` — "Optimistic checks with Proxy" pattern (not required by this task's AC, referenced for the open question below)
- `../.github/workflows/playwright.yml` (repo root — one level above this `nextjoblog/` project directory) — existing Playwright CI job; runs on every push/PR/dispatch, `working-directory: nextjoblog`, will pick up a new `e2e/login.spec.ts` automatically

## Architecture Insights

- **The login feature is additive, not foundational.** Every piece of shared infrastructure (proxy, Supabase client factory, Server Action pattern, design tokens, test tooling) already exists from the sign-up story. This task only adds: one new Server Action (`login`), one new route (`/login`) with its component tree, one new color-token pair (`--danger-tint`/`--danger-fg`), and matching Vitest/Playwright tests.
- **The AC's anti-enumeration and case-insensitivity requirements are both already satisfied by Supabase's own server-side behavior** — the app-level work is to *not undermine* them (i.e., don't inspect which field failed, don't add a client-side `.toLowerCase()` that could diverge from server behavior), not to implement new logic for them.
- **`styles.ts`, `PasswordField`-style helper components, and `Logo`/`AuthLogo` are shared-shape assets** — a login `PasswordField` doesn't need the helper-text/validation-message plumbing the signup one has (login has no password-shape validation), so it may warrant its own simpler field markup rather than reusing `app/signup/PasswordField.tsx` verbatim; this is a planning decision, not a research finding.
- **Route guarding is a real gap in the app today** (any route, including a future `/dashboard`, is reachable while logged out), but it is confirmed out of scope for this task — it's tracked as its own story, GitHub issue #6 ("Story 0.4 — Redirect Unauthenticated Users from Protected Pages"), which depends on this task rather than the reverse.

## Historical Context (from prior changes)

- `context/changes/sign-up-for-a-new-account/plan.md` — phase-by-phase implementation plan, fully completed; direct structural template (see Historical context section above).
- `context/changes/sign-up-for-a-new-account/research.md` — prior research on the same auth infrastructure, superseded/extended by this document for login-specific facts (this doc does not repeat facts already stable there, e.g. `proxy.ts` naming convention, `getAll`/`setAll` cookie API, Tailwind v4 import syntax).
- `context/changes/sign-up-for-a-new-account/reviews/impl-review.md` and `reviews/plan-review.md` — review findings and lessons noted inline above where relevant.
- `context/foundation/lessons.md` does not exist — no cross-change lessons file to consult.

## Related Research

- `context/changes/sign-up-for-a-new-account/research.md`

## Open Questions

1. ~~**Is route-guarding (redirecting an unauthenticated user away from `/dashboard`) in scope for this task, or a separate future task?**~~ **Resolved — confirmed by Natta (2026-09-07), see Follow-up Research below:** 0.2 and 0.4 are two different kinds of event, not two depths of the same feature. **Story 0.2 (this task)** is the authenticated action a user deliberately takes — enters credentials, clicks "Log In," the system verifies them and establishes a session; the AC is entirely about that verification (correct credentials succeed, wrong credentials get the generic error, RLS scopes data once authenticated) and only fires when someone chooses to log in. **Story 0.4** is a defensive guard with no credentials involved at all — it runs on *every* protected-route request regardless of user intent (e.g. typing `/dashboard` directly into the URL bar) and checks whether a valid session already exists, redirecting to `/login` if not. That's precisely why 0.4 depends on both 0.2 (a login system must exist to redirect to) and 0.3/stay-logged-in (the guard must check *restored* session state, not just a state set by a fresh login). Net effect for this task: implement `signInWithPassword` + session establishment + redirect-on-success only; `proxy.ts` gains no guard/redirect logic here — that belongs entirely to 0.4.
2. **Exact wording/behavior for a login submit-button pending state.** Dug further into this: grepped the entire design mockup (`nextjoblog-mvp-screens.html`) for ellipsis-style pending-state copy (`"…"`) and found only one other match — `Loading…` at line 1241 — which is the mockup *viewer's own UI chrome* (a placeholder note shown by the demo page's nav JS before it populates a screen's title/ref, unrelated to any form). There is no `README.md`, style guide, or copy-conventions doc anywhere in the repo (checked `README.md`, `AGENTS.md`, `CLAUDE.md`, and `supabase/docs/`) that governs button copy. **Confirmed: there is no source of truth to look up here — this is genuinely a planning-time decision, not an unresearched fact.** The natural default, consistent with the existing `SignupForm`'s `isPending` button text "Creating account…" (`app/signup/SignupForm.tsx:31` via `SignupFields.tsx:31`), would be "Logging in…"; flag this default to the user during planning rather than silently deciding it.

## Follow-up Research 2026-09-07T21:58:02+02:00

The user created GitHub issues for the backlog after the initial research pass (which had found zero issues in the repo). Re-checked `github.com/Nattarintra/nextjoblog/issues` and fetched the three relevant issue bodies directly.

**Issues now live** (all open, filed 2026-09-07 by Nattarintra):
- **#2** — Story 0 — Account Setup & Data Foundation (the parent story)
- **#4** — Story 0.2 — Log In to an Existing Account (this task)
- **#5** — Story 0.3 — Stay Logged In Across Browser Sessions
- **#6** — Story 0.4 — Redirect Unauthenticated Users from Protected Pages
- **#7** — Story 0.5 — Log Out of the App
- **#8** — Story 0.6 — Request a Password Reset Email

**Content verification**: fetched the full raw body of #2 and #4 and diffed them mentally against the text originally pasted into this research's invocation — both match verbatim (same Acceptance Criteria, Dependencies, Out of Scope, and Open-Questions-with-decisions text). No new information was hiding in the GitHub issue that wasn't already in the pasted text.

**New information from #6** (not previously available, since this story didn't exist as a separate ticket when the original research ran): the parent Story 0's "redirect unauthenticated users from protected pages" edge case has been split out into its own story, #6, which **depends on #4 (this task) and #5 (stay-logged-in)** rather than the reverse. Its own AC additionally scopes in a deep-link-return-to-original-page behavior (flagged there as an open question, not yet decided) and a fail-closed requirement for session-check errors — none of which are this task's concern. This is a clean, explicit resolution of this document's Open Question #1: **do not add any route-guard/redirect logic to `proxy.ts` as part of the login task** — that work belongs entirely to issue #6.

No other findings in this document required revision as a result of the issues being created — the schema, design-mockup, Supabase Auth API, and reusable-infrastructure findings above are all still accurate and unaffected by this update.

## Follow-up Research 2026-09-07 (Open Questions review)

Dug into both remaining open questions on request.

**Open Question #1 (route-guarding scope), user-confirmed:** Natta clarified the precise boundary between 0.2 and 0.4 directly (not just inferred from issue text): 0.2 is the user-initiated authentication act (submit credentials → verify → establish session), while 0.4 is a credential-free defensive guard that runs on every protected-route request to check for an existing valid session, independent of whether that session came from a fresh login or a restored one. This is now folded into the Open Questions entry above as the authoritative resolution. No plan-time ambiguity remains: this task's Server Action does verification + session establishment + redirect only.

**Open Question #2 (pending-state button copy):** no new information — already confirmed in the prior follow-up pass that no source of truth exists in the repo for this copy decision (see that entry above); still a planning-time call, default suggested there ("Logging in…").
