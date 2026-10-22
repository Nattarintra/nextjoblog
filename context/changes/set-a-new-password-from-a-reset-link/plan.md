# Set a New Password from a Reset Link (Story 0.7) Implementation Plan

## Overview

Build the second half of the password-reset flow: `/reset-password`, where a Job Seeker opens the emailed link, sets and confirms a new password, and lands on the Dashboard already logged in with a "Password updated" toast. Expired, used, missing or rejected links show "This Reset Link No Longer Works" with a route back to `/forgot-password`.

Design source: `supabase/docs/nextjoblog-mvp-screens.html` — `scr-reset` (1833-1884, incl. the "Too short" example), `scr-reset-done` (1886-1996), `scr-reset-expired` (1998-2031); dev notes 2905-2907 and 3031-3032. Decisions already taken in `research.md`: minimum length 6, auto-login, Server Action, inline save errors, scanner-consumed links documented as a limitation.

**Constraints from the invocation**
- **E2E cannot run locally** (macOS 13 cannot run Playwright Chromium). Unit/component tests run locally; Playwright and `supabase test db` run only in GitHub Actions on Ubuntu. The CI run ID is the evidence.
- **No hard-coded values**: every number, path, copy string, storage key and fragment key is a named constant with one definition.
- **DRY**: the password rule, the password input, auth styles, the stateless Supabase client and the E2E admin/user/mail setup each have one definition.

## Current State Analysis

- `/reset-password` is a public path (`lib/auth/paths.ts:6-12`) with no page, so the emailed link 404s. Story 0.6 sends the link from a stateless client (implicit flow), so it lands on `/reset-password#access_token=…&refresh_token=…&type=recovery`, or `#error_code=otp_expired…` (`research.md` §1).
- Min length 6 is private in `app/signup/password-validation.ts:1`, a bare `6` at `app/actions/auth.ts:69`, and in both `config.toml` files.
- `app/signup/PasswordField.tsx` is bound to Sign Up wording (fixed `id="password"`, label, helper).
- Shared auth UI exists in `components/auth/` (`AuthPageShell`, `styles`, `AuthStatusIcons`, `AuthLogo`, `fonts`); copy in `lib/auth/messages.ts`; protected shell in `app/(protected)/_components/ProtectedAppShell.tsx`.
- E2E: `supabaseAdmin` is re-created in `login.spec.ts`, `forgot-password.spec.ts`, `session-expiry.spec.ts`, and `signup.spec.ts`; passwords and session decoding are also shared or duplicated across `e2e/helpers/auth-session.ts`, `route-guard.spec.ts`, `logout.spec.ts`, and `session-expired-route.spec.ts`. `uniqueEmail`/`seedConfirmedUser` are local to forgot-password. `e2e/helpers/auth-email.ts` provides Mailpit helpers.
- CI: `.github/workflows/playwright.yml` already runs unit tests, `supabase test db` and Playwright via `scripts/run-e2e.mjs`, which already supplies Supabase keys, `PASSWORD_RESET_ENABLED=1`, `E2E_TEST_HOOKS=1` and the mail URL. No workflow change is needed.
- Vitest gates: 80% global, 90% for `lib/auth/**`; focused runs need `--coverage.enabled=false`.

## Desired End State

- Valid link → form → save → cookie session → `/dashboard` with a toast; `router.replace` stops Back returning to the used link.
- Short password → inline minimum message, provider not called, password unchanged. Server `weak_password` shows the same message.
- Expired/used/missing/rejected link → expired screen with "Request a New Link" (`/forgot-password`) and "Back to Log In" (`/login`).
- Before a successful save no cookie exists, so protected pages stay locked.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run test:run` pass locally; the CI workflow passes with the new specs; run ID recorded in Progress.

### Key Discoveries:

- The fragment never reaches the server, so parsing is client-side; `@supabase/ssr`'s browser client rejects implicit URLs (`GoTrueClient.ts:3865`), so cookies are written by a Server Action (`research.md` §1, Decisions).
- Create the cookie session only after `updateUser` succeeds, otherwise a rejected save leaves the user logged in through the link with the old password (`research.md` §2).
- The 30-day clock reads `claims.amr?.[0]` (`lib/session/claims.ts:9`); whether a recovery session carries it is proven in CI, not assumed.
- `"use server"` files can export only async functions, so the state union, constants and regexes live in `lib/`.
- The form subtitle email is not in the link; it is read from the unverified `email` claim of the access token (display only).

## What We're NOT Doing

- Password-changed notification email, signing out other devices, MFA (all out of scope in `change.md`).
- Custom `token_hash` email template or interstitial; scanner-consumed links are documented only.
- Running Playwright locally; changing the hosted Supabase dashboard from code (documented manual steps).
- `/api/auth/confirm` (superseded); the `config.toml` allow-list entry stays.
- Defensive changes to shared session code before CI shows they are needed (decision: the CI test is the gate).

## Implementation Approach

Bottom-up, each phase independently verifiable. Single sources of truth, enforced in every phase:

| Concern | Single source |
| --- | --- |
| Min length, helper text, length check | `lib/auth/password-policy.ts` |
| All user-visible copy | `lib/auth/messages.ts` |
| Paths | `lib/auth/paths.ts` (add `RESET_PASSWORD_PATH`, `FORGOT_PASSWORD_PATH`; reuse `LOGIN_PATH`, `DEFAULT_POST_LOGIN_PATH`) |
| Fragment keys, toast flag key, toast dismiss delay | `lib/auth/password-reset-confirm-config.ts` |
| Auth classes, button, status ring, field error | `components/auth/styles.ts` (check before adding) |
| Stateless Supabase client | `lib/supabase/stateless.ts` (used by 0.6 and 0.7 actions) |
| E2E admin client, users, passwords, mail, reset-link request | `e2e/helpers/*` |

## Phase 1: Shared password policy and input

### Overview

Remove the duplicated password rule and promote a generic password input before anything new depends on them. No visible change to Sign Up.

### Changes Required:

#### 1. Password policy

**File**: `lib/auth/password-policy.ts` (new)

**Intent**: One definition of the minimum length and its helper text, usable by client and server.

**Contract**: exports `MIN_PASSWORD_LENGTH = 6`, `PASSWORD_HELPER_TEXT` (derived, "At least 6 characters"), `isPasswordLongEnough(password): boolean`.

#### 2. Sign Up adoption

**File**: `app/signup/password-validation.ts`, `app/actions/auth.ts:69`

**Intent**: Replace the private constant and the bare `6` with imports from the policy.

**Contract**: `getPasswordValidationError` and the `signup` action keep identical outputs; existing tests unchanged.

#### 3. Generic password input

**File**: `components/auth/PasswordInput.tsx` (new); `app/signup/PasswordField.tsx`

**Intent**: Promote a parameterised input with a Show/Hide toggle; Sign Up's field wraps it with its current label, id and helper.

**Contract**: props `id`, `name`, `label`, `autoComplete`, `describedBy`, `error`, optional `value`/`onChange` (controlled for reset, uncontrolled for Sign Up); toggle is `<button type="button" aria-pressed>` whose accessible name includes the field label; input `type` switches `password`/`text`.

#### 4. Reset copy and paths

**File**: `lib/auth/messages.ts`, `lib/auth/paths.ts`, `lib/auth/password-reset-confirm-config.ts` (new)

**Intent**: Put every new string, path and constant in one place, taking wording from the mockup lines above.

**Contract**: copy for form h1/sub, field labels, requirement labels, button idle/pending, errors (`too_short`, `mismatch`, `offline`, `same_password`, `network`, `unknown`), toast title/body, expired h1/sub/steps/CTAs/footnote; config exports fragment key names, toast flag key, `PASSWORD_UPDATED_TOAST_DISMISS_MS`.

### Success Criteria:

#### Automated Verification:

- Existing Sign Up tests pass unmodified: `npx vitest run __tests__/signup __tests__/actions --coverage.enabled=false`
- New policy boundary test (5/6/7 chars) passes: `npx vitest run __tests__/lib/auth/password-policy.test.ts --coverage.enabled=false`
- `PasswordInput` toggle test passes (type switch, `aria-pressed`, label)
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Sign Up page looks and behaves exactly as before

**Implementation Note**: After automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Recovery logic in `lib/auth/`

### Overview

All decision logic as pure, injectable functions under the 90% coverage gate.

### Changes Required:

#### 1. Fragment parser and email reader

**File**: `lib/auth/recovery-fragment.ts` (new)

**Intent**: Turn `location.hash` into a closed result and read the display email from the token without verifying it.

**Contract**: `parseRecoveryFragment(hash)` → `{kind:"tokens", accessToken, refreshToken} | {kind:"error", code} | {kind:"none"}` (tokens require both values and `type=recovery`); `readRecoveryEmail(accessToken)` → `string | undefined`, never throws.

#### 2. Validator

**File**: `lib/auth/new-password.ts` (new)

**Intent**: Validate length and match from a list of rule objects so a future rule is data, not code.

**Contract**: `validateNewPassword({password, confirmation})` → `ok | too_short | mismatch` (too_short first); rules `{id, messageKey, test}` exported for the requirements list. Rule objects contain no user-visible copy; `messageKey` resolves through `lib/auth/messages.ts`.

#### 3. Error classifier and use case

**File**: `lib/auth/complete-password-reset.ts`, `lib/auth/password-reset-confirm-state.ts` (new)

**Intent**: Orchestrate validate → stateless set+update → start cookie session, with a closed result; never start the session after a failure. The cookie session uses the latest session tokens returned by Supabase, not blindly the original fragment tokens.

**Contract**: `classifyRecoveryError(error)` → `too_short | same_password | expired | network | unknown` (`weak_password`; `same_password`; `otp_expired`/`session_expired`/`session_not_found`/`refresh_token_not_found`/`refresh_token_already_used`/`bad_jwt`/invalid JWT; status 0/5xx/fetch failure). `AuthSessionMissingError` and equivalent dead-session variants map to `expired`. `completePasswordReset(deps, input)` with ports `RecoveryAuthClient {setSession, updateUser}` and `SessionStarter {start(tokens)}`. Both auth-client methods expose the latest returned session tokens; the use case passes the latest available tokens from `setSession`/`updateUser` to `SessionStarter`, including refreshed or rotated tokens. State union: `updated | too_short | mismatch | offline | same_password | network | expired | unknown`; `offline` is produced locally before the Server Action is called and is not a provider-classifier result.

### Success Criteria:

#### Automated Verification:

- Parser table tests pass (tokens, error, none, malformed, missing type, extra params)
- Email reader tests pass (valid, no claim, garbage, bad base64)
- Validator and classifier tests pass for every code, including missing-session and consumed/unknown refresh-token variants mapping to `expired`
- Use-case tests pass: starter never called after any failure; provider never called on `too_short`/`mismatch`; starter receives refreshed/rotated tokens returned by the provider rather than the original fragment tokens
- Focused run: `npx vitest run __tests__/lib/auth --coverage.enabled=false`
- Full run with coverage gates (90% `lib/auth/**`): `npm run test:run`
- Type checking and linting pass

#### Manual Verification:

- None (pure logic)

**Implementation Note**: After automated checks pass, pause for manual confirmation before Phase 3.

---

## Phase 3: Server Action and cookie session

### Overview

A thin Server Action adapts the use case to real Supabase clients and writes the session cookies exactly as login does.

### Changes Required:

#### 1. Shared stateless client

**File**: `lib/supabase/stateless.ts` (new); `app/actions/password-reset.ts`

**Intent**: Extract the stateless client (`persistSession`, `detectSessionInUrl`, `autoRefreshToken` all false) so 0.6 and 0.7 share it.

**Contract**: `createStatelessSupabaseClient()` using the same env names as 0.6; 0.6 behavior and tests unchanged.

#### 2. Reset action

**File**: `app/actions/reset-password.ts` (new)

**Intent**: Parse `FormData` (tokens, password, confirmation), build adapters, run `completePasswordReset`, return the state union; start the session through `createServerSupabaseClient()` using the resulting provider session tokens.

**Contract**: `(prevState, formData) => Promise<PasswordResetConfirmState>`; logs `auth.password_reset_confirm.*` via `logAuthEvent` with `describeAuthError` (`{code,status}` only); no cookie written on any failure; tokens/passwords/emails never logged.

#### 3. Config check

**File**: `supabase/config.toml`, `supabase-test/supabase/config.toml`

**Intent**: Confirm `minimum_password_length = 6` in both copies; no change expected.

**Contract**: values equal `MIN_PASSWORD_LENGTH`.

### Success Criteria:

#### Automated Verification:

- Action tests pass: session written once on success, never on failure, provider not called on invalid input, no secret in log calls: `npx vitest run __tests__/actions --coverage.enabled=false`
- Story 0.6 action tests still pass unmodified
- Type checking, linting and full `npm run test:run` pass

#### Manual Verification:

- None (exercised end to end in Phase 5 CI)

**Implementation Note**: After automated checks pass, pause for manual confirmation before Phase 4.

---

## Phase 4: UI

### Overview

Render the three mockup screens and the toast from the action state; no business logic in components.

### Changes Required:

#### 1. Page and flow

**File**: `app/reset-password/page.tsx`, `app/reset-password/ResetPasswordFlow.tsx` (new)

**Intent**: Server page with `metadata` and `AuthPageShell`; a client flow with states `checking | form | expired` that reads the fragment on mount, strips it with `history.replaceState`, and keeps tokens in memory only.

**Contract**: hash getter injectable for tests; `tokens` → form; `error`/`none` → expired; action result `expired` → expired and tokens dropped; `updated` → set toast flag then `router.replace(DEFAULT_POST_LOGIN_PATH)`.

#### 2. Form and requirements

**File**: `app/reset-password/NewPasswordForm.tsx`, `PasswordRequirements.tsx` (new)

**Intent**: Two controlled `PasswordInput`s (values survive action results), requirements list built from the validator's rule objects, submit with `aria-busy` and "Saving…".

**Contract**: `navigator.onLine` checked before submit (reuse `OFFLINE_ERROR_MESSAGE`); inline `role="alert"` error; focus first invalid field for `too_short`/`mismatch`/`same_password`, the alert otherwise; requirements show text + icon (not colour only) and a count `n / MIN_PASSWORD_LENGTH`.

#### 3. Expired screen

**File**: `app/reset-password/ResetLinkExpiredScreen.tsx` (new)

**Intent**: Reuse the status ring and secondary-on-dark button from `components/auth/`; `h1` with `tabIndex={-1}` focused on mount.

**Contract**: `role="alert"` sub text; links built from path constants, "Request a New Link" opens `/forgot-password` with an empty field.

#### 4. Toast

**File**: `app/(protected)/_components/PasswordUpdatedToast.tsx` (new); `ProtectedAppShell.tsx`

**Intent**: One-time confirmation read from `sessionStorage`, mounted once in the shell so it works on any protected page.

**Contract**: `role="status"`; flag read and cleared inside try/catch (page works without storage); auto-dismiss after `PASSWORD_UPDATED_TOAST_DISMISS_MS`; close button with `aria-label`; no focus steal.

### Success Criteria:

#### Automated Verification:

- Component tests pass for `checking`, `form`, `expired`, show/hide, offline and short-password messages with the action not called, focus targets, fragment stripped after read: `npx vitest run __tests__/reset-password --coverage.enabled=false`
- Toast tests pass (shows once, clears flag, fake-timer dismiss, works when `sessionStorage` throws): `npx vitest run __tests__/protected --coverage.enabled=false`
- Full `npm run test:run` passes with coverage gates
- Type checking and linting pass

#### Manual Verification:

- Visual match against the three mockup screens (form, Dashboard toast, expired) at 375px width
- Keyboard-only pass and screen-reader announcement of errors and the toast
- Request a real link in the preview deployment and complete the flow

**Implementation Note**: After automated checks pass, pause for manual confirmation before Phase 5.

---

## Phase 5: CI-only E2E

### Overview

Author shared E2E helpers and the reset spec locally; they run only in the existing GitHub Actions `e2e-tests` job. Nothing here is executed on the development Mac.

### Changes Required:

#### 1. Shared helpers and migration

**File**: `e2e/helpers/supabase-admin.ts`, `e2e/helpers/auth-users.ts` (new); `e2e/helpers/auth-email.ts`, `e2e/helpers/auth-session.ts`; `e2e/forgot-password.spec.ts`, `e2e/login.spec.ts`, `e2e/session-expiry.spec.ts`, `e2e/signup.spec.ts`, `e2e/route-guard.spec.ts`, `e2e/logout.spec.ts`, `e2e/session-expired-route.spec.ts`

**Intent**: One admin client and one set of user/password helpers; one helper that requests a reset and returns the recovery URL; migrate every affected existing spec with no behavior change. Preserve or update compatibility exports for existing `auth-session.ts` consumers, and move the AMR/session-start decoder there so the reset spec can reuse it.

**Contract**: `supabaseAdmin`; `TEST_PASSWORD`, `NEW_PASSWORD`, `uniqueEmail(prefix)`, `seedConfirmedUser(email, password?)`; shared password and session/AMR decoding helpers used by all affected specs; `requestResetAndGetLink(page, email, ip)` built on `waitForRecoveryEmail`; mailbox cleanup shared via a fixture or `afterEach`.

#### 2. Reset spec

**File**: `e2e/reset-password.spec.ts` (new)

**Intent**: Prove the flow against the real stack and settle the inferences in `research.md`.

**Contract**: unique email per test and the `x-e2e-client-ip` headers used by the 0.6 spec; bounded `expect.poll` waits, no sleeps; all copy and paths imported from `messages.ts`/`paths.ts`. Cases:
- Happy path in a fresh browser context: link lands on `/reset-password` with fragment tokens; save → `/dashboard`, toast visible; reload still signed in; Back does not return to the link.
- Immediate login with the new password; the old password is rejected.
- Session clock: after reset, the session has a valid base time from `amr[0]` (using `auth-session.ts`/`auth-cookies.ts`).
- Too short: inline message, URL unchanged, no session cookie, old password still works.
- Mismatch and same-password: inline errors, nothing changes.
- Used link: opening the same URL a second time shows the expired screen; "Request a New Link" goes to `/forgot-password`.
- Older link after a second request: expired screen (requires the second request to use another client IP header to avoid the 60 s cooldown).
- Direct visit with no fragment: expired screen.
- Protected before save: with the form loaded but unsaved, `/dashboard` redirects to login.

### Success Criteria:

#### Automated Verification:

- Type checking and linting pass locally (specs compile): `npx tsc --noEmit`, `npm run lint`
- Unit tests still pass locally: `npm run test:run`
- GitHub Actions `unit-tests` job is green on the branch
- GitHub Actions `e2e-tests` job is green (existing specs plus `reset-password.spec.ts`, `supabase test db`)
- CI run ID and Playwright report artifact recorded in this plan's notes

#### Manual Verification:

- Read the CI Playwright report and confirm the session-clock test asserts `amr` and was not skipped

**Implementation Note**: If the session-clock test fails in CI, stop and discuss the fix before Phase 6 (decision: CI is the gate, no speculative change to shared session code).

---

## Phase 6: Docs and release gate

### Overview

Document hosted settings and the known limitation, then enable the feature in Production after a smoke test.

### Changes Required:

#### 1. Production docs

**File**: `docs/production-auth.md`

**Intent**: Hosted dashboard minimum length must equal `MIN_PASSWORD_LENGTH`; redirect allow-list must contain `https://nextjoblog.vercel.app/reset-password`; "Known limitations" for scanner-consumed links; the release step for `PASSWORD_RESET_ENABLED`; and the superseded Story 0.6 hand-off must be replaced so it no longer instructs operators to use `/api/auth/confirm`, block recovery sessions from protected pages, or require a separate login after reset.

**Contract**: sections §1 and §4 plus the Story 0.7 hand-off and `PASSWORD_RESET_ENABLED` description are updated; the documented behavior is Server Action completion followed by auto-login to Dashboard; no code.

#### 2. Change record

**File**: `context/changes/set-a-new-password-from-a-reset-link/change.md`

**Intent**: Point at `research.md`, `plan.md`, `plan-brief.md`; status stays `planned` until implementation starts.

**Contract**: frontmatter `status`, `updated`.

### Success Criteria:

#### Automated Verification:

- Linting passes and no code changed in this phase: `npm run lint`

#### Manual Verification:

- Hosted smoke test: request → email → set password → Dashboard with toast
- `PASSWORD_RESET_ENABLED` enabled in Production after the smoke test

---

## Testing Strategy

### Unit Tests:

- Policy, parser, email reader, validator, classifier, use-case order, action, form/flow/expired components, toast, `PasswordInput`.
- Security invariants as tests: no cookie without a successful update; no provider call on invalid input; tokens/passwords never logged or persisted; fragment stripped.
- Coverage gates: 80% global, 90% for `lib/auth/**`.

### Integration Tests:

- Playwright in CI only (Phase 5) against local Supabase and Mailpit, `workers: 1`.

### Manual Testing Steps:

1. Request a link from Login → Forgot password and open it from the email.
2. Try a 4-character password, then a mismatched confirmation, then a valid one.
3. Confirm the Dashboard toast, then reuse the same link and confirm the expired screen.

## Performance Considerations

None material. One extra POST of short-lived tokens to our own server; tokens are never stored or logged.

## Migration Notes

No database migration. `supabase-test/supabase/config.toml` must keep `minimum_password_length = 6` in step with `supabase/config.toml`.

## References

- Related research: `context/changes/set-a-new-password-from-a-reset-link/research.md`
- Brief: `context/changes/set-a-new-password-from-a-reset-link/plan-brief.md`
- Prior change: `context/archive/2026-10-17-request-password-reset-email/{plan,research}.md`, `reviews/impl-review.md`
- Design: `supabase/docs/nextjoblog-mvp-screens.html:1833-2031, 2905-2907, 3031-3032`
- Similar pattern: `app/actions/password-reset.ts`, `e2e/forgot-password.spec.ts`, `e2e/helpers/auth-email.ts`

## Verification Notes

- Unit-tests CI run: pending
- E2E CI run: pending
- Playwright report artifact: pending
- Session-clock / `amr[0]` assertion: pending
- Local, CI, and hosted differences: pending

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared password policy and input

#### Automated

- [ ] 1.1 Existing Sign Up tests pass unmodified
- [ ] 1.2 Password policy boundary test passes
- [ ] 1.3 PasswordInput toggle test passes
- [ ] 1.4 Type checking passes
- [ ] 1.5 Linting passes

#### Manual

- [ ] 1.6 Sign Up page looks and behaves as before

### Phase 2: Recovery logic in lib/auth

#### Automated

- [ ] 2.1 Fragment parser table tests pass
- [ ] 2.2 Email reader tests pass
- [ ] 2.3 Validator and classifier tests pass
- [ ] 2.4 Use-case order tests pass
- [ ] 2.5 Focused lib/auth test run passes
- [ ] 2.6 Full run with 90% lib/auth coverage gate passes
- [ ] 2.7 Type checking and linting pass

### Phase 3: Server Action and cookie session

#### Automated

- [ ] 3.1 Reset action tests pass
- [ ] 3.2 Story 0.6 action tests pass unmodified
- [ ] 3.3 Type checking, linting and full test run pass

### Phase 4: UI

#### Automated

- [ ] 4.1 Reset-password component tests pass
- [ ] 4.2 Toast tests pass
- [ ] 4.3 Full test run with coverage gates passes
- [ ] 4.4 Type checking and linting pass

#### Manual

- [ ] 4.5 Visual match against the three mockup screens at 375px
- [ ] 4.6 Keyboard-only and screen-reader pass
- [ ] 4.7 Real link completed in the preview deployment

### Phase 5: CI-only E2E

#### Automated

- [ ] 5.1 Specs compile and lint locally
- [ ] 5.2 Unit tests pass locally
- [ ] 5.3 GitHub Actions unit-tests job green
- [ ] 5.4 GitHub Actions e2e-tests job green
- [ ] 5.5 CI run ID and report artifact recorded

#### Manual

- [ ] 5.6 CI report confirms the session-clock test ran and asserted amr

### Phase 6: Docs and release gate

#### Automated

- [ ] 6.1 Linting passes with docs-only changes

#### Manual

- [ ] 6.2 Hosted smoke test passes
- [ ] 6.3 PASSWORD_RESET_ENABLED enabled in Production
