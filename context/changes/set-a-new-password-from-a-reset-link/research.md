---
date: 2026-10-22T00:00:00+02:00
researcher: Natta
git_commit: 120d24c45d79b65972b3d9741b24aabadee551a9
branch: feat/set-a-new-password-from-a-reset-link
repository: nextjoblog
topic: "Set a new password from a reset link (Story 0.7): /reset-password, link expired/used, password updated login banner"
tags: [research, auth, password-reset, supabase, nextjs-16, tailwind, a11y, testing]
status: complete
last_updated: 2026-10-22
last_updated_by: Natta
last_updated_note: "All nine open questions resolved: minimum length 6, auto-login, Server Action, inline save-failure errors, scanner limitation, CI checks, change.md pointer, notification email out of scope"
---

# Research: Set a new password from a reset link (Story 0.7)

## Research Question

How to build the second half of the reset flow. Inputs: this change's `change.md`, the archived Story 0.6 docs (`context/archive/2026-10-17-request-password-reset-email/`), `supabase/docs/` (schema, `nextjoblog-mvp-screens.html` lines 1787-1900 and dev notes 2905-2907). Quality bar: at least 80% coverage, SOLID, clean code, a11y, Next.js project-structure and Tailwind best practice.

## Summary

Story 0.6 left `/reset-password` public (`lib/auth/paths.ts`) but there is no page, no action and no recovery handling. Six findings shape the design.

1. **The link uses the implicit flow, not PKCE or `token_hash`.**
   - 0.6 sends the email from a stateless `createClient(..., { persistSession: false, detectSessionInUrl: false })` (`app/actions/password-reset.ts`). auth-js defaults to `flowType: 'implicit'` (`GoTrueClient.ts:204`) and sends no code challenge.
   - So Supabase's default `{{ .ConfirmationURL }}` redirects to `/reset-password#access_token=…&refresh_token=…&type=recovery`.
   - Failures arrive the same way: `#error=access_denied&error_code=otp_expired&error_description=…`.
   - A URL fragment never reaches the server. The page must read it in a **client component**. It works across devices and browsers, because there is no verifier cookie.
   - The archived plan's `/api/auth/confirm` + `verifyOtp` design was superseded by the Free-plan decision to keep the default template (plan.md "Link contract"). No `/api/auth/confirm` handler is needed. The allow-list entry already in `supabase/config.toml:162` is unused and can stay or go.
   - This is inferred from auth-js source and not yet proven against the real stack. Verify it in CI by capturing the email (Mailpit helper exists in `e2e/helpers/auth-email.ts`) and asserting the redirect shape.
2. **Auto-login (decided): a real cookie session, created only after the password is saved.**
   - The mockup (`scr-reset-done`, lines 1886-1996; notes at 3031-3032) says: on success the user stays logged in, no `signOut()`, `router.replace('/dashboard')`, a "Password updated" toast, and a fresh 30-day session cycle (Story 0.3). `replace` keeps Back from returning to the used link. No `next` is carried over.
   - The fragment tokens live only in the browser. Until the save succeeds there is no cookie, so `proxy.ts` and `requireSession()` see no session and protected pages stay unreachable. That meets the archived boundary ("no protected access before the password update") with no recovery marker or classifier.
   - **Trap to design around**: if the cookie session is created *before* `updateUser`, a rejected save (too short, same password, network) would leave the user logged in through the link with the old password. So validate and update with a **stateless** client (`persistSession: false`), and create the cookie session only after that succeeds.
   - **Verify in CI**: `getBaseSessionExpiresAt` reads `claims.amr[0].timestamp` (`lib/session/claims.ts`). A recovery session's first `amr` entry is expected to be `{ method: "otp", timestamp }` set at link click (inside the 1-hour link window). If it is absent the session is classed `invalid` and the user bounces to login. Confirm this and that the 30-day clock starts from it.
   - `@supabase/ssr`'s browser client forces PKCE and rejects implicit URLs (`GoTrueClient.ts:3865`), so our own code parses the fragment.
3. **The minimum password length is 6, but the rule is duplicated.**
   - The product rule is **6 characters**, and the 0.7 mockup agrees ("At least 6 characters", count `4 / 6`, server-side minimum 6).
   - It is encoded in five places that must stay in sync:
     - `app/signup/password-validation.ts:1`: `MIN_PASSWORD_LENGTH = 6`, **not exported**, plus the derived `PASSWORD_HELPER_TEXT`.
     - `app/actions/auth.ts:69`: a **magic number** `password.length < 6`, a second copy of the same rule.
     - `supabase/config.toml:181` and `supabase-test/supabase/config.toml:192`: `minimum_password_length = 6`.
     - The hosted Supabase dashboard (manual setting).
   - Fix as part of this story: move the constant and helper text to `lib/auth/password-policy.ts` (exported, 90% coverage gate), and have Sign Up validation, the `signup` action, and the reset flow import it. Existing tests (`password-validation.test.ts`, `SignupForm.test.tsx`, `auth.test.ts`) keep their "At least 6 characters" expectations.
4. **The minimum length must also be enforced server-side.**
   - A client-side check is only UX; the authority is Supabase's `minimum_password_length`. A too-short password returns `weak_password` (`AuthWeakPasswordError`, status 422).
   - Map that error to the same "minimum requirement" message, so the AC holds even if the client check is bypassed.
   - The hosted dashboard value must match the code constant (document it in `docs/production-auth.md`).
5. **Expired and used links need three detection paths.**
   - The error is in the fragment (`error_code=otp_expired`). The mockup note says to read it on load.
   - There may be no fragment at all, for example someone browsing to `/reset-password` directly or reloading after the fragment was stripped.
   - `setSession` can also fail on an expired access token.
   - All three show the same "This Reset Link No Longer Works" screen. This is the same neutral copy as the mockup ("expired or already used").
   - Strip the fragment from the URL after reading it (`history.replaceState`) so tokens do not stay in the address bar or browser history.
6. **The release gate and docs need updating.**
   - `PASSWORD_RESET_ENABLED` hides the Login link and disables sending until 0.7 ships (`app/login/page.tsx`, `docs/production-auth.md` §1 and §4).
   - Enabling it in Production is a deployment step of this story, after hosted redirect URLs and the minimum length are verified.

## Detailed Findings

### 1. Requirements (`change.md`)

- **Happy path**: valid link, enter and confirm a new password, the password updates and the user can log in immediately with it.
- **Edge**: too-short password shows the minimum requirement and does not update.
- **Error**: expired or used link shows an expired/used message with "request a new one" routing to `/forgot-password`.
- **Out of scope**: MFA. **Open questions**: "None" (this research finds a few; see below).

### 2. What 0.6 left behind

- Public paths: `/forgot-password`, `/reset-password`, `/api/auth` (`lib/auth/paths.ts:6-12`).
- Shared auth UI in `components/auth/`: `AuthPageShell`, `fonts`, `styles`, `AuthStatusIcons`, `AuthLogo`. The forgot-password screens already contain a status ring, steps, secondary-on-dark button and field-error styles. **Reuse these for the expired screen** rather than adding another copy. Check `components/auth/styles.ts` before adding classes.
- `useCountdown` (`lib/hooks/`), `isValidEmail`/`normalizeEmail` (`lib/auth/email.ts`) and `logAuthEvent` (`lib/auth/log.ts`) are available.
- `NEXT_PUBLIC_SITE_URL`, `isValidSiteUrl` (`lib/auth/site-url.ts`) and `redirectTo` handling exist from 0.6. `redirectTo` is the `/reset-password` URL.
- Local Supabase config: `site_url`, allow-list with `/reset-password`, `email_sent = 100`, `otp_expiry = 3600` (link valid 1 hour), default recovery template.
- Hand-offs written into 0.6 that this story must close:
  - the emailed link currently 404s until this page exists;
  - recovery-session handling and post-success behavior;
  - a `/login?next=…` hand-off must not be honoured for reset (`resolvePostLoginPath` already rejects `?next=/reset-password`);
  - run the hosted smoke test and enable `PASSWORD_RESET_ENABLED`.
- Pattern notes from the 0.6 impl-review that apply again: log only `{code,status}`, test hooks gated by `isE2eHooksEnabled`, assert provider/limiter not called on invalid input, record CI run IDs, and assert absence with a bounded wait (not by clearing).

### 3. Existing patterns to follow

- Flat public route folders, PascalCase components, kebab-case logic: `app/signup/{page,SignupForm,SignupFields,PasswordField,SignupAlerts}.tsx`, `password-validation.ts`; `app/forgot-password/*`. Matches the Next project-structure doc (`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`): colocate by route, `_`-prefixed private folders are optional, keep the route outside `(protected)` (guard test `__tests__/protected-pages-guard.test.ts`).
- Pages are server components that export `metadata` and render `<AuthPageShell>`; interactive parts are `"use client"` children. `/reset-password/page.tsx` follows that and renders a client `ResetPasswordFlow`.
- `PasswordField` (`app/signup/PasswordField.tsx`) is bound to the signup wording ("Password", fixed `id="password"`, hard-coded helper). The reset form needs labelled New and Confirm fields with a show/hide toggle (mockup `pw-toggle`) and a requirements list. **Promote a generic, parameterised password input to `components/auth/`** (label, id, name, autocomplete, describedby, error) and let Signup use it too, rather than a second copy. Keep Signup's visible behavior unchanged.
- Server Action convention (`app/actions/auth.ts`): `"use server"` files export only async functions; shared types, constants and regexes live in `lib/auth/`. Note that for this story most of the work is browser-side, so a Server Action is **not** the natural fit (see Architecture Insights).
- Login's `loggedOut` banner is **not** reused for this story: after a reset the user goes to the Dashboard. The "Password updated" confirmation is a toast on the Dashboard instead (see section 4). Login needs no change.
- Logging: new events follow the `auth.<area>.<kind>` naming and `describeAuthError` (`{code,status}` only). Tokens, email, passwords and fragments are never logged.

### 4. Design source (`nextjoblog-mvp-screens.html` 1787-1900, 2905-2907)

- **`scr-reset`** "Set a New Password": h1, sub text with the account email in bold (safe because only the link holder can open the page), New and Confirm fields with `autocomplete="new-password"` and Show/Hide toggles, a requirements list ("At least 6 characters", "Both passwords match", met/unmet with icons and a count like `4 / 6`), a primary "Save New Password". The "Too short" example below the divider is mockup-only: `aria-invalid="true"`, `aria-describedby`, message "Use at least 6 characters. Your password hasn't been changed." Do not build the divider or the example label.
- **`scr-reset-done`** "Dashboard — Password Updated": the normal Dashboard with a `role="status"` toast "**Password updated** You're logged in with your new password.". The toast reads a one-time flag from **client state, not a URL param**, auto-dismisses after about 5 seconds, and has a ✕ close button. Other devices stay logged in (Supabase does not end other sessions on a password change; logout-everywhere is out of scope, Story 0.5).
- **`scr-reset-expired`**: danger status ring with a broken-link icon, h1 "This Reset Link No Longer Works", `role="alert"` sub "…so your password hasn't been changed.", three steps, primary "Request a New Link" (to `/forgot-password`, field empty) and secondary-on-dark "Back to Log In".
- Dev notes to honour: validate length (and match) on the client first so a short password never reaches Supabase; keep the server minimum equal; disable the button with a spinner while saving; on network failure show an inline error and keep the form filled (this case is not in the AC; flag it as an addition); `new-password` autocomplete on both fields.
- No Login email prefill is needed with auto-login.

### 5. Supabase behaviour and config

- `setSession({ access_token, refresh_token })` on a stateless client verifies the token with the server and keeps the session in memory only. `updateUser({ password })` then updates the user. It requires a session; with none it returns `AuthSessionMissingError`. The same tokens are then given to the cookie-backed server client to start the real session.
- `config.toml`: `minimum_password_length = 6`, `password_requirements = ""`, `secure_password_change = false` (a recent login is not required), `otp_expiry = 3600`. `[auth.email.notification.password_changed]` exists but is commented out. Enabling it needs SMTP/hosted settings and is optional (security notice). Note, do not build it here.
- GoTrue behaviours to verify in CI, not assume: that the fragment has `type=recovery`; that an opened link cannot be reused (second visit gives `otp_expired`); that `updateUser` with an unchanged password returns `same_password` (422) - decide copy; that email-scanner prefetch can consume a one-time link (a known risk of the implicit flow: some mail clients open links before the user does, which then shows "expired"). This is a limitation of the default template on the Free plan. Record it in the runbook and make the expired screen's copy cover it, which it already does.
- Hosted dashboard: redirect allow-list must contain `https://nextjoblog.vercel.app/reset-password`; minimum length must match the code. Both are manual steps.

### 6. Testing infrastructure

- Vitest: jsdom, `__tests__/**/*.test.{ts,tsx}`, coverage always on (v8). Gates: 80% global, **90% for `lib/auth/**`**. Excluded: `proxy.ts`, `lib/supabase/server.ts`, `lib/auth/request-path.ts`. Focused runs need `--coverage.enabled=false`.
- `__tests__/` mirrors source: `forgot-password/`, `login/`, `signup/`, `lib/auth/`, `actions/`, `api/auth/`. Add `reset-password/` and `lib/auth/*.test.ts`.
- Patterns: `vi.hoisted` mocks, `AuthApiError(msg, status, code)` for provider errors, fake timers for the hook, `getByLabelText`/`getByRole("alert")`/`aria-invalid` queries, `useActionState` mocked for forms.
- jsdom needs a way to set `window.location.hash`; inject a `getHash()` function into the fragment parser instead of reading `window` inside the logic, so tests stay pure.
- Playwright: needs a local Supabase stack, `workers: 1`, run **only in GitHub Actions on Ubuntu** (macOS 13 cannot run Chromium). `e2e/helpers/auth-email.ts` already polls Mailpit (`waitForRecoveryEmail`, `clearMailbox`) and `e2e/forgot-password.spec.ts` exists with a unique-email and admin-client convention. 0.7 extends these: happy path (request, capture, open in a fresh context, set password, log in with the new one), short password, expired/used link (second open of the same link), protected pages not reachable before the update, old password no longer works.
- The CI workflow already runs unit, `supabase test db` and Playwright; record the run ID as evidence.

### 7. Accessibility

- Labels with `htmlFor`, `autocomplete="new-password"`, `aria-invalid` and `aria-describedby` pointing at the requirements list and the error, `role="alert"` for errors and the expired message, `role="status"` for the success banner.
- The Show/Hide toggle is a real `<button type="button">` with `aria-pressed` and a label that names the field ("Show new password"); the password field type switches between `password` and `text`.
- The requirements list: do not rely on colour. Use text ("met"/"not met" visually hidden) plus icons. Do not announce on every keystroke; announce on submit or blur, or keep the list as static text and announce only the error.
- Focus management: on a screen change (form to expired), focus the `<h1>` (`tabIndex={-1}`), as in the 0.6 flow. After a validation error focus the first invalid field. The toast does not take focus; it is announced through `role="status"`.
- Contrast: the `text-white/50` helper text and `#ffb4ab` danger text on navy were flagged in 0.6; reuse the checked tokens.
- Loading: button `disabled` plus `aria-busy` and a visible pending label ("Saving…").

## Code References

- `lib/auth/paths.ts:6-12` - `/reset-password` public
- `app/actions/password-reset.ts` - stateless `createClient` (implicit flow), `redirectTo`
- `node_modules/@supabase/auth-js/src/GoTrueClient.ts:204,3862-3877` - default implicit flow; PKCE rejects an implicit URL
- `node_modules/@supabase/auth-js/src/GoTrueClient.ts:4464` - `resetPasswordForEmail` flow branch
- `app/signup/PasswordField.tsx`, `app/signup/password-validation.ts` - password UI and the min length of 6
- `app/actions/auth.ts` - `password.length < 6`, action conventions
- `supabase/config.toml:158-162,181,184,198,227,233` - site URL, allow-list, password rules, email limits
- `app/login/page.tsx`, `app/login/LoginForm.tsx` - `loggedOut` banner pattern, `forgotPasswordEnabled`
- `components/auth/*` - shared shell, styles, status icons
- `lib/auth/next-path.ts` - rejects `/reset-password` as a post-login target
- `proxy.ts`, `lib/auth/require-session.ts`, `lib/session/*` - cookie-based session reads and the 30-day / extension logic that the new session joins
- `e2e/helpers/auth-email.ts`, `e2e/forgot-password.spec.ts` - mail capture and E2E conventions
- `supabase/docs/nextjoblog-mvp-screens.html:1787-1900,2905-2907` - screens and dev notes
- `context/archive/2026-10-17-request-password-reset-email/{plan,research}.md`, `reviews/impl-review.md` - hand-offs and lessons

## Architecture Insights

Proposed units (a proposal for the plan, SOLID-oriented):

- **Pure logic in `lib/auth/`** (90% gate, all injectable):
  - `parseRecoveryFragment(hash)` returns `{ kind: "tokens", accessToken, refreshToken } | { kind: "error", code } | { kind: "none" }`. Pure.
  - `validateNewPassword({ password, confirmation })` returns a closed result (`ok | too_short | mismatch`) using the shared `password-policy` constant.
  - `classifyRecoveryError(error)` maps provider errors to `weak_password | same_password | expired | network | unknown`. Mirrors `describeAuthError`.
  - `completePasswordReset(deps, input)` use case over two injected ports: a stateless `RecoveryAuthClient` (`setSession`, `updateUser`) and a `SessionStarter` (cookie session from tokens). Order is fixed: validate, stateless set + update, then start the cookie session; the starter is never called when an earlier step fails. Returns a closed result type.
- **Server Action (revised from the earlier "browser only" decision)**: `app/actions/reset-password.ts` takes the fragment tokens plus the new password, runs the use case, and writes the cookie session through `createServerSupabaseClient()` (same cookie handling as login, so the session is identical to a normal one). Reasons auto-login changes the answer: the browser path would need `@supabase/ssr`'s browser client to write cookies, which forces PKCE; the action reuses the existing server client, logs failures safely as `{code,status}` with `logAuthEvent`, and keeps cookie handling in one place. Cost: the one-hour access token and refresh token pass through one extra POST to our own server (HTTPS, never logged, never stored).
- **Client**: `ResetPasswordFlow.tsx` reads the fragment on mount, strips it with `history.replaceState`, keeps the tokens in component memory, and calls the action via `useActionState`. On `{ status: "updated" }` it sets the one-time toast flag and calls `router.replace('/dashboard')`. (Not `redirect()` inside the action, because the client must set the flag first.)
- **Toast**: `PasswordUpdatedToast` in `app/(protected)/_components/`, a client component that reads and clears the flag from `sessionStorage` (wrapped in try/catch, the page works without it), `role="status"`, auto-dismiss via a named constant (about 5 s), close button with `aria-label`.
- **UI**: `app/reset-password/page.tsx` (server, metadata, shell), `ResetPasswordFlow.tsx` (state machine `checking | form | expired`), `NewPasswordForm.tsx`, `PasswordRequirements.tsx`, `ResetLinkExpiredScreen.tsx`. Generic `PasswordInput` with the show/hide toggle in `components/auth/`. Expired screen reuses the status ring and secondary button.
- **Named constants** (no magic numbers): `MIN_PASSWORD_LENGTH`, fragment keys, toast flag key, toast dismiss delay. Messages in `lib/auth/messages.ts`.
- **Security invariants for tests**: tokens never logged and never persisted (fragment stripped, kept in memory only); no cookie is written unless the password update succeeded; a rejected or short password never starts a session; short or mismatched input never calls the provider; before success `requireSession()` still redirects to login; after success the session has a valid `amr` base time and reaches `/dashboard`; the old password no longer works.
- **Open for extension**: password rules as an array of rule objects (`id`, `label`, `test`) so a future rule (e.g. a digit requirement) is a data change not a code change in the list and the validator.

## Historical Context

- `2026-10-17-request-password-reset-email` (archived): neutral outcomes, layered limits, default-template decision, `PASSWORD_RESET_ENABLED` gate, CI-only E2E, impl-review approved.
- `2026-09-07-log-in-an-existing-account`: generic credentials errors, banner patterns.
- `sign-up-for-a-new-account`: password rules, action conventions.
- `redirect-unauthenticated-users`: `/reset-password` registered public.
- `context/foundation/lessons.md` does not exist.

## Decisions (2026-10-22)

### Decision: Minimum password length is 6

**Status**: accepted for planning

**Decision**:

The new password must be at least 6 characters, the same rule as Sign Up. The 0.7 mockup is aligned to 6.

**Implementation flow**:

1. Create `lib/auth/password-policy.ts` exporting `MIN_PASSWORD_LENGTH = 6` and the helper text ("At least 6 characters").
2. Sign Up (`app/signup/password-validation.ts`) and the `signup` action (`app/actions/auth.ts:69`, currently a bare `6`) import it. Their visible text and tests do not change.
3. `validateNewPassword` in the reset flow imports it. The client checks length and match first, so a short password never reaches Supabase.
4. Supabase still enforces the rule: `minimum_password_length = 6` in `supabase/config.toml` and `supabase-test/supabase/config.toml`, and the hosted dashboard (manual step, documented in `docs/production-auth.md`). A server rejection (`weak_password`, 422) shows the same minimum-requirement message and leaves the password unchanged.

**Rationale**:

- It matches the existing product rule, so one rule applies on Sign Up and Reset, with no surprise for existing users.
- The rule was written in several places, including a magic number in `auth.ts`. One constant makes it easy to change later without missing a copy (maintainability).
- Checking on the client and in Supabase gives fast feedback plus a rule that cannot be bypassed.

### Decision: Auto-login after a successful reset

**Status**: accepted for planning (matches mockup `scr-reset-done`, lines 1886-1996, decided 22 Oct 2026)

**Decision**:

When the password is saved, the user stays logged in and lands on `/dashboard` with a "Password updated" toast. There is no second login step. This replaces the earlier "sign out, then log in" option.

**Implementation flow**:

1. The user opens the emailed link. Supabase redirects to `/reset-password#access_token=…&refresh_token=…&type=recovery` (implicit flow). A failed or used link carries `#error_code=otp_expired` instead.
2. `ResetPasswordFlow` (client) reads the fragment with `parseRecoveryFragment`, strips it from the address bar with `history.replaceState`, and keeps the tokens in component memory only.
3. Tokens present: show the form. Error code, no fragment, or a token Supabase rejects: show the "This Reset Link No Longer Works" screen.
4. The user submits. The client validates length and match.
5. The Server Action receives the tokens and the new password and calls `completePasswordReset`:
   1. a **stateless** client (`persistSession: false`) runs `setSession`, then `updateUser({ password })`;
   2. only if that succeeds, the cookie-backed server client (`createServerSupabaseClient`) starts the real session from the resulting tokens, so cookies are written exactly as for a normal login;
   3. any failure returns a closed error state (`weak_password`, `same_password`, `expired`, `network`, `unknown`) and writes **no cookies**.
6. On `{ status: "updated" }` the client sets a one-time flag in `sessionStorage`, then calls `router.replace('/dashboard')`. `replace` stops Back from returning to the used link. No `next` is carried over.
7. `PasswordUpdatedToast` on the Dashboard reads and clears the flag, shows a `role="status"` toast, and dismisses after about 5 seconds (named constant) or on the close button.
8. The new session is a normal login: the 30-day cycle starts now and the usual "Stay logged in?" prompt applies 2 days before it ends. Other devices stay logged in (out of scope, Story 0.5).

**Rationale**:

- The user asked for the fewest steps after a reset, and the mockup was updated to show it.
- Before the save there is no cookie session, so `proxy.ts` and `requireSession()` see nothing and protected pages stay locked. This meets the archived rule "no protected access before the password update" with no recovery marker, and answers archived open questions 10 and 13.
- Creating the cookie session only after `updateUser` succeeds prevents a failed save from leaving someone logged in through the link while the old password still works.
- The link already proves control of the inbox, so logging in after the change adds no new exposure compared with the reset itself.
- Risk to verify in CI: the 30-day clock reads `claims.amr[0].timestamp` (`lib/session/claims.ts`). If a recovery session has no such entry, the session is classed `invalid` and the user bounces to login. Confirm the entry exists and the clock starts from it.

### Decision: Password update runs in a Server Action

**Status**: accepted for planning (revises the earlier "browser, stateless client" choice)

**Decision**:

The browser sends the fragment tokens and the new password to a Server Action (`app/actions/reset-password.ts`). The action orchestrates the update and writes the cookies. The business logic lives in `lib/auth/` behind injected ports.

**Implementation flow**:

1. Pure functions in `lib/auth/` (90% coverage gate): `parseRecoveryFragment`, `validateNewPassword`, `classifyRecoveryError`, `completePasswordReset`.
2. `completePasswordReset(deps, input)` depends on two small ports: `RecoveryAuthClient` (`setSession`, `updateUser`) and `SessionStarter` (start a cookie session from tokens). Real adapters wrap Supabase. Unit tests use fakes.
3. Fixed order: validate input, stateless update, then start the cookie session. The starter is never called after an earlier failure.
4. The action is a thin adapter: parse `FormData`, build the real adapters, call the use case, map the result to a state union that lives in `lib/auth/` (a `"use server"` file can export only async functions).
5. Failures are logged with `logAuthEvent` and `describeAuthError`, only as `{code,status}`. Tokens, passwords and emails are never logged.

**Rationale**:

- Auto-login needs cookies. A browser client from `@supabase/ssr` forces PKCE and rejects the implicit-flow URL (`GoTrueClient.ts:3865`), so the browser path would need a custom cookie writer.
- The existing server client already writes the session cookies for login. Reusing it keeps one way of creating a session, in one place.
- Server-side logging works, which a browser-only update would not give.
- The ports keep each piece small and testable (SOLID: single responsibility, dependency inversion) and let the storage or provider change later without touching the use case.
- The cost is one extra HTTPS POST of the tokens to our own server. They are short-lived, never logged, never stored.

### Decision: Save failures show inline errors and keep the form filled

**Status**: accepted for planning (covers cases the AC does not list; the mockup dev note asks for the network case)

**Decision**:

A failed save never starts a session and never loses what the user typed. Each failure maps to one closed error code and one message, shown inline above the button with `role="alert"`. The user can correct the input and retry without reopening the email.

| Code | When | Message (draft) | Next step |
| --- | --- | --- | --- |
| `too_short` | client check, or Supabase `weak_password` (422) | "Use at least 6 characters. Your password hasn't been changed." | Fix the field and retry |
| `mismatch` | client check, confirmation differs | "The two passwords don't match." | Fix the field and retry |
| `same_password` | Supabase `same_password` (422): new equals current | "Choose a password different from your current one. Your password hasn't been changed." | Change the field and retry |
| `offline` | `navigator.onLine` is false before submit | Existing `OFFLINE_ERROR_MESSAGE` | Reconnect and retry |
| `network` | the request or the Supabase call fails (fetch error, status 0, 5xx) | "We couldn't save your password. Check your connection and try again." | Retry, tokens still in memory |
| `expired` | Supabase rejects the tokens (`otp_expired`, `session_expired`, invalid JWT) | none; switch to the "This Reset Link No Longer Works" screen | Request a new link |
| `unknown` | anything else | "Something went wrong. Please try again." | Retry |

**Implementation flow**:

1. `validateNewPassword` returns `too_short` or `mismatch` on the client, before any request.
2. The submit handler checks `navigator.onLine` first, as `useSessionExtension` does, and returns `offline` without calling the action.
3. The Server Action runs `completePasswordReset`. `classifyRecoveryError` maps the provider error to `too_short`, `same_password`, `expired`, `network` or `unknown`. It uses `isAuthApiError` codes and status, like the existing predicates in `app/actions/auth.ts`.
4. Fields are **controlled** components, so the values survive the action result (an uncontrolled form is reset by React after an action). Tokens stay in `ResetPasswordFlow` memory.
5. On `expired` the flow switches to the expired screen and drops the tokens. Every other error keeps the form and shows the message. Focus moves to the first invalid field for `too_short`, `mismatch` and `same_password`, and to the alert for the rest.
6. Failures log only `{code,status}` via `logAuthEvent` (`auth.password_reset_confirm.provider_error`, `...unexpected_error`). No cookie is written on any failure.
7. Messages live in `lib/auth/messages.ts`, not inline.

**Rationale**:

- The user can fix the problem in place, so a typo or a bad connection does not cost a new email and the rate-limit budget from Story 0.6.
- Keeping the link usable is safe: the one-time code was already spent when Supabase issued the tokens, and the tokens live in memory only for a short time. A reload loses them and shows the expired screen, which is correct.
- `same_password` is shown instead of treated as success, because the user asked to change the password and should be told that nothing changed. It also avoids a silent path where a reset appears to work but proves nothing.
- A closed set of codes makes each branch testable and keeps the copy in one place (extensibility: a new error is a new code and message, not a change to the form).

### Decision: Scanner-consumed links are an accepted, documented limitation

**Status**: accepted for planning

**Decision**:

Some mail clients and security scanners open links before the user does. With Supabase's default `{{ .ConfirmationURL }}` template, that request spends the one-time token, so the user later sees the "This Reset Link No Longer Works" screen. We do not change the template (a custom `token_hash` template is not available on the chosen Free plan path). The product handles it through copy and a short route to a new link, and the runbook records it.

**Implementation flow**:

1. No code change to the email. The expired screen already says "expired or already used" and offers **Request a New Link** (to `/forgot-password`, field empty) and **Back to Log In**.
2. Add a "Known limitations" note to `docs/production-auth.md`: scanner prefetch can consume the link; the symptom is a user reporting an "expired" link they never opened; the remedy is requesting a new link.
3. The 60-second resend cooldown and IP limit from Story 0.6 still apply to the new request, so this cannot be used to bypass abuse limits.
4. If support reports show this is common, the follow-up is a custom `token_hash` template and an interstitial confirm button (needs a paid or custom-SMTP setup). Not in this story.

**Rationale**:

- The fix needs a plan change that was already decided against in Story 0.6.
- The user-visible damage is small: one extra email, and the screen explains what to do.
- Recording it means a later support question has a known answer instead of a new investigation.

### Decision: Provider behaviour is verified in CI before the story is closed

**Status**: accepted for planning

**Decision**:

Every Supabase behaviour this design relies on and that is not documented is proved by a Playwright spec in GitHub Actions on Ubuntu. Local macOS 13 cannot run Chromium, so the CI run ID and report are the evidence, as in Story 0.6.

**Implementation flow**:

1. Extend `e2e/forgot-password.spec.ts` or add `e2e/reset-password.spec.ts`, reusing `waitForRecoveryEmail`, `clearMailbox` and the unique-email plus service-role seeding conventions. `waitForRecoveryEmail` already returns the `ConfirmationURL`; the spec follows it, so the redirect and fragment shape are tested as Supabase really sends them.
2. Checks, each one a test or assertion:
   - the redirect ends at `/reset-password#access_token=…&refresh_token=…&type=recovery`;
   - happy path: set a new password, land on `/dashboard`, toast visible, a protected page loads (proves `amr[0].timestamp` and the 30-day base time);
   - the old password no longer logs in; the new one does after logging out;
   - too-short password: message shown, nothing changed, no auth cookies set;
   - same password: inline error, nothing changed;
   - second open of the same link: expired screen (`otp_expired`);
   - no fragment (direct visit) shows the expired screen;
   - the link opens in a fresh browser context (cross-device);
   - before a successful save, `/dashboard` redirects to login;
   - after a failed save, no auth cookie exists.
3. The webServer env keeps `PASSWORD_RESET_ENABLED=1`.
4. Record the CI run ID, the Playwright artifact and any local/CI/hosted differences in the plan Progress notes.

**Rationale**:

- Several points come from reading auth-js source, not from running Supabase: the implicit fragment shape, `amr[0]` on a recovery session, the error shape of `weak_password` and `same_password`, and what a stateless client writes. A wrong guess would break the main flow.
- The auto-login design depends on `amr[0].timestamp`; a failing assertion here is the earliest warning.
- Reusing the Story 0.6 helpers keeps the new tests small.

### Decision: `change.md` points to research.md for decisions

**Status**: accepted; applied

**Decision**:

`change.md` kept "Open Questions: None" while the research found real ones. It now states that decisions and follow-ups live in `research.md`, and lists the resolved ones.

**Implementation flow**:

1. Replace "None" in `change.md` with a pointer to `research.md` and a short list of the decisions (minimum length 6, auto-login, Server Action, inline failure errors, scanner limitation).
2. Keep the acceptance criteria text unchanged. Note that the AC "log in immediately" is met by auto-login.

**Rationale**:

- The story file is the first thing a reader opens. A stale "None" hides decisions that change the build.

### Decision: Password-changed notification email is out of scope

**Status**: accepted for planning

**Decision**:

Do not send a "your password was changed" email in this story. Record it as a later security enhancement.

**Implementation flow**:

1. Nothing is built. `[auth.email.notification.password_changed]` stays commented out in `supabase/config.toml`.
2. Add a line to the "Out of Scope" notes in `change.md` and to the runbook's follow-ups.
3. When picked up later it needs hosted SMTP and a template, a local template file, and a test that reads the mail through the existing helper.

**Rationale**:

- It is not in the acceptance criteria, and the built-in mailer is already capped at a few emails per hour (see `docs/production-auth.md`).
- It adds an email path that can fail independently of the password update, so it deserves its own story and tests.

## Open Questions

All nine items are resolved by the Decisions above. Items still to do in implementation are listed in the Plan Inputs.

1. **Minimum length: resolved, 6.** Mockup, code and config agree. Remaining work is to remove the duplication (see Summary finding 3) and confirm the hosted dashboard value.
2. **Auto-login vs log in again after reset?** Resolved: auto-login to the Dashboard, per the updated mockup (22 Oct 2026). Remaining check: the `amr` base time (see Summary finding 2).
3. **Client update or Server Action?** Resolved: Server Action (see Architecture Insights).
4. **Email prefill on Login** - not applicable with auto-login.
5. **Network-failure and `same_password` copy** - resolved: see Decision "Save failures show inline errors and keep the form filled".
6. **Scanner-consumed links** - resolved: accepted limitation, documented (see Decision).
7. **Verify in CI** - resolved: CI spec list defined (see Decision).
8. **`change.md` says "Open Questions: None"** - resolved and applied (see Decision).
9. **Password-changed notification email** - resolved: out of scope, recorded as a follow-up.

## Plan Inputs (for `/10x-plan`)

- Phases suggested: (1) pure logic + `password-policy` + tests (90%); (2) shared `PasswordInput`/requirements and Signup adoption; (3) Server Action + `/reset-password` flow and screens; (4) Dashboard toast; (5) CI E2E (happy path lands on `/dashboard` with toast, old password rejected, short password, expired/used link, no protected access before save), docs, enable `PASSWORD_RESET_ENABLED` in Production, record CI run ID.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run test:run` locally; Playwright and DB tests in GitHub Actions only.

### Follow-up changes the plan must create

Two items are out of scope here but must not be lost. The plan creates one change folder for each under `context/changes/` (each with its own `change.md`, via `/10x-new`), and links them from this change's Out of Scope notes.

| Suggested change id | Story summary | Notes carried over from this research |
| --- | --- | --- |
| `sign-out-all-devices-after-password-reset` | When a password reset succeeds, every other session of the account is signed out, while the device that did the reset stays logged in. | Supabase does not end other sessions on a password change. Candidate approach: after `updateUser`, revoke sessions with `signOut({ scope: "others" })` on the cookie-backed client, or a global revoke followed by a fresh sign-in. Check the JWT risk: with asymmetric signing keys `getClaims` verifies locally, so another device's access token can work until `jwt_expiry` (3600 s). Needs a CI test with a second browser context. Depends on this change. |
| `send-password-changed-notification-email` | After a successful reset (and later any password change), the account email gets a "your password was changed" notice. | Needs hosted SMTP and a template, and a local `[auth.email.notification.password_changed]` template. Test with the existing mail helper `e2e/helpers/auth-email.ts`. The built-in mailer is capped at a few emails per hour (`docs/production-auth.md`). Depends on this change. |

#### Story: Sign out of all devices after a password reset

**Change id**: `sign-out-all-devices-after-password-reset`

**User story**: As a Job Seeker, I want every other device signed out when I reset my password, so that anyone holding an old session, such as a lost laptop or a shared computer, loses access as soon as the password changes.

**Acceptance criteria**

- **Happy path**: Given I am logged in on another device or browser, when I complete a password reset on this device, then that other session is ended and its next request goes to Log In, while this device stays logged in.
- **Edge case**: Given I have several sessions on different devices, when the reset succeeds, then all of them except the current one are ended.
- **Error handling**: Given the password was updated but ending the other sessions fails, when the reset finishes, then the failure is logged without tokens or passwords and the user is told that other devices may still be logged in, with a way to log in again.
- **Non-functional**: Revoked access tokens may stay valid until `jwt_expiry` (3600 s) on projects with asymmetric signing keys, so the window is documented or closed.

**Out of scope**: a manual "log out of all devices" button (Story 0.5 area), MFA.

**Dependencies**: this change (`set-a-new-password-from-a-reset-link`).

**Open questions**: which Supabase signing algorithm the hosted project uses (decides whether the JWT window exists).

#### Story: Password-changed notification email

**Change id**: `send-password-changed-notification-email`

**User story**: As a Job Seeker, I want an email when my password is changed, so that I notice a change I did not make and can act on it.

**Acceptance criteria**

- **Happy path**: Given I complete a password reset, when the new password is saved, then a "your password was changed" email is sent to my account address.
- **Edge case**: Given the account email is shared in the message, then it contains no password, token or link that signs me in, and tells me what to do if I did not make the change.
- **Error handling**: Given sending the notification fails, when the reset has already succeeded, then the reset is not undone, the failure is logged without personal data, and the user's flow is not blocked.
- **Non-functional**: Sent through a real SMTP provider in production, because the built-in mailer allows only a few emails per hour.

**Out of scope**: notifications for other account changes, SMS or push.

**Dependencies**: this change; hosted SMTP and a template; the local `[auth.email.notification.password_changed]` template for tests.

**Open questions**: whether the notice also applies to a password change made while logged in (a later story).

Naming follows the existing kebab-case ids (`log-out-of-the-app`, `set-a-new-password-from-a-reset-link`).
