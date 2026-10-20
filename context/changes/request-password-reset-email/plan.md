# Request a Password Reset Email (Story 0.6) Implementation Plan

## Overview

Build the first half of the password-reset flow: a `/forgot-password` page where a Job Seeker enters their email and receives a reset link, without the system ever revealing whether an account exists. The flow has three screens (form, Check Your Email, Too Many Reset Requests), a layered rate limiter (visible per-IP limit, silent per-email limits) on a Postgres token-bucket store behind a `RateLimiter` port, and Supabase's default recovery email using `ConfirmationURL`. Story 0.7 owns consuming the link.

All new code follows SOLID, DRY and a11y rules from the invocation: pure functions in `lib/auth/`, injected dependencies (clock, sleep, limiter, Supabase client), named constants instead of magic numbers, small composable components, and no duplication of the auth shell.

**Verification constraint**: the development Mac (macOS 13) cannot run the Chromium Playwright suite and E2E must not be run locally. Unit and component tests run locally; Playwright and the SQL (pgTAP) tests run only in GitHub Actions on Ubuntu. The CI run ID is the evidence.

## Current State Analysis

- `/forgot-password` and `/reset-password` are already public paths (`lib/auth/paths.ts:6-12`). The login page links to `/forgot-password` (`app/login/LoginFields.tsx:51-55`), which currently 404s.
- There is no reset action, page, limiter, IP reader, `/api/auth/confirm` handler or mail-reading E2E helper.
- Login and Signup duplicate the font setup, page class, per-form `styles` object and `submitButtonClassName` (`app/login/*`, `app/signup/*`). Signup uses a `<div>` for its heading; Login uses `<h1>`.
- Server actions live in `app/actions/auth.ts` (`"use server"`, `(prevState, formData) => Promise<State>`, discriminated-union state, `logAuthEvent` with only `{code,status}`). The email regex is private to that file.
- Supabase auth config is local-only (`supabase/config.toml`; a manual copy lives in `supabase-test/supabase/`): `email_sent = 2`, `additional_redirect_urls` does not allow-list the reset or confirm URL, and no email templates are customised.
- CI (`.github/workflows/playwright.yml`) already has `unit-tests` and `e2e-tests` jobs on Ubuntu with Supabase CLI 2.117.0 and `supabase db reset`.
- Vitest gates: 80% global, 90% for `lib/auth/**`; focused runs need `--coverage.enabled=false`.

## Desired End State

- A user clicks "Forgot password?" on Login, submits a valid email and always lands on **Check Your Email** (registered, unknown, per-email-limited and provider-failure cases are indistinguishable in output). A registered address receives Supabase's default recovery email whose `ConfirmationURL` redirects to `/reset-password`.
- More than 5 requests per hour from one IP shows **Too Many Reset Requests** with a server-authoritative countdown. This is the only distinguishable state.
- Login, Signup and Forgot Password share one auth shell, fonts and button/status styles from `components/auth/`.
- Verification: `npm run lint`, `npx tsc --noEmit` and `npm run test:run` (coverage gates) pass locally; the CI workflow passes (unit, `supabase test db`, Playwright) and its run ID is recorded in this plan's Progress notes.

### Key Discoveries:

- Anti-enumeration is not automatic: provider 429s (`over_email_send_rate_limit`) may appear only for real accounts, so every provider outcome maps to `sent` (`research.md` §3).
- Supabase limits are project-wide and expose no retry-after, so the countdown needs an app limiter (`research.md` §3, §5).
- The default Supabase recovery flow owns the confirmation link; Story 0.7 must implement the standard recovery redirect and session handling.
- `"use server"` files can only export async functions, so shared constants/regex/types live in `lib/auth/`.
- `/api/auth` is already a public prefix, so `/api/auth/confirm` needs no route-access change (`lib/auth/paths.ts:6-12`).
- `supabase-test/supabase/migrations/` is a manual copy and drifts unless updated together (`supabase/migrations/README.md`).

## What We're NOT Doing

- The confirm handler (`/api/auth/confirm`), `verifyOtp`, the `/reset-password` page, `updateUser({ password })`, invalid/expired link states and recovery-session handling: Story 0.7. Consequence: the emailed link 404s until 0.7 ships, so 0.6 must not be released to production alone.
- SMS or any non-email channel; CAPTCHA.
- A Redis/Upstash limiter (the port keeps it possible later).
- Changing hosted Supabase settings from code; hosted dashboard steps are documented, not automated.
- Refactoring Login/Signup beyond adopting the shared primitives (no field, validation or action changes).

## Implementation Approach

Layered, bottom-up, each phase independently verifiable:

1. Extract shared auth UI primitives first so the new route builds on them (no behavior change, existing tests are the safety net).
2. Build the limiter foundation (pure helpers, port, adapters, SQL).
3. Build the use case and thin Server Action over injected ports, plus Supabase config/template.
4. Build the UI that only renders action state.
5. Add CI-only E2E, docs and evidence.

Decisions taken during planning (beyond `research.md`):

| Decision | Choice |
| --- | --- |
| Per-email limits | Two silent rules on the same keyed limiter: 60 s cooldown (capacity 1) and 5/hour ceiling (capacity 5, refill 12 min) |
| Check order | Validate input, then IP (visible), then email cooldown, then email hourly. A denied email rule skips the provider and returns `sent`; the hourly rule is only consumed when the cooldown allows |
| Timing | `MIN_RESPONSE_MS` floor applied in the use case via injected `now`/`sleep`, for every outcome |
| Limiter store | One generic `rate_limit_buckets` table and atomic token-bucket RPC `consume_rate_limit`, with opportunistic expired-row cleanup in the RPC |
| Keys | `HMAC-SHA256(RATE_LIMIT_HASH_SECRET, scope + ":" + value)`; email value is trimmed, NFKC-normalised, lowercased; IP from `x-vercel-forwarded-for` validated with `net.isIP`, otherwise a single shared `unknown` bucket |
| Limiter failure | Fail closed on sending: log safely, skip the provider call, return `sent` |
| Link contract | Keep Supabase's default `{{ .ConfirmationURL }}` template; `redirectTo` is the same-origin `/reset-password` URL built from `NEXT_PUBLIC_SITE_URL` |
| Testing | Vitest 80/90 gates locally; pgTAP and Playwright in CI only |
| Release gate (review F1) | `PASSWORD_RESET_ENABLED` env flag. When unset/false the Login "Forgot password?" link is hidden and the action returns the neutral `sent` without sending. Enabled in Production only when Story 0.7 ships |
| Timing (review F2, replaces the floor-only approach) | The provider call runs in Next `after()` so response time is independent of account existence; a small `MIN_RESPONSE_MS` floor remains only to level limiter RPC-count variance. Verified in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`: `after` is supported in Server Functions, runs on Vercel via `waitUntil` for up to the route's max duration, and may call `cookies()`/`headers()` inside the callback there. Read `headers()` before scheduling anyway. Probed on `next dev` (2026-10-20): the action returned in ~0.05 s while the `after()` work ran 3 s later, a header read before scheduling reached the callback, and no `Set-Cookie` was written. Not yet proven on Vercel (`waitUntil`) or against real Supabase |
| Missing IP header (review F3) | Honor a test IP header only when `E2E_TEST_HOOKS=1`. In production a missing/invalid header uses a looser dedicated `unknown` bucket (higher capacity), so it cannot lock out all users |
| Provider client (review F5) | Plain stateless `createClient` (`persistSession: false`), not the SSR client; no cookies written |

## Critical Implementation Details

- **Anti-enumeration invariant**: the action's output for registered, unknown, per-email-limited, provider-error (including 429) and limiter-failure cases must be byte-identical (`{ status: "sent", email }`). Only `invalid_email` (input shape, not account state) and `rate_limited` (IP) differ. Unit-test this as one parametrised assertion.
- **RPC exposure**: the app only has the anon key, so `consume_rate_limit` is executable by `anon`/`authenticated` (revoked from `public`). It is safe because keys are HMACs with a server-only secret (a caller cannot target another user's bucket), the table has RLS enabled with no policies, the function pins `search_path`, and it clamps `p_capacity` and `p_refill_interval_seconds` to sane bounds. Cleanup inside the RPC bounds growth from arbitrary callers.
- **Echoed email**: the sent screen shows the email held in client state from the action result; the email is never placed in a URL or log.
- **Env**: `RATE_LIMIT_HASH_SECRET` is a new server-only variable (Vercel Production, local `.env.local`, Playwright webServer env). It is validated at the config boundary (present, minimum length). A missing/weak secret logs a distinct safe code (`auth.password_reset.configuration_error`) and returns `sent`; the post-deploy smoke step must check that emails actually send (review F6). `PASSWORD_RESET_ENABLED` is the release gate (review F1).
- **`after()` error handling** (review F2): a throw or rejection inside an `after()` callback does not change the response and does not stop other `after()` callbacks (probed on `next dev`: response 200 in ~0.03 s, a third callback still ran, the next request was healthy). But Next logs the full error to the server log, which could include data the plan forbids logging. So the deferred callback must wrap the provider call in `try/catch`, never rethrow, map the error through `describeAuthError`, and log only `{code,status}` via `logAuthEvent`. The provider call also needs a named timeout so it finishes inside the route's max duration on Vercel.
- **Reload behavior** (review F7): the screen is rendered from action state only. A reload returns to the empty form; the server limiter stays authoritative, so a resubmit returns `rate_limited` again (a denied request consumes no token).
- **Silent limits** (review F9): an email-limited user sees Check Your Email and receives nothing, by design. Document this and the intent of the email hourly ceiling (distributed-abuse protection) in `docs/production-auth.md`; log a safe `rate_limited` count for IP tuning.
- **Story 0.7 hand-off** (review F10): `redirectTo` only satisfies allow-list validation; the link comes from the template. The 0.7 handler must ignore or strictly allow-list `next`.

---

## Phase 1: Shared auth primitives (no behavior change)

### Overview

Remove existing duplication and give the new route a shell to build on, while Login and Signup tests prove nothing changed.

### Changes Required:

#### 1. Shared page shell and fonts

**Files**: `components/auth/AuthPageShell.tsx`, `components/auth/fonts.ts`, `app/login/page.tsx`, `app/signup/page.tsx`

**Intent**: Move the repeated `Archivo`/`Work_Sans` font setup, `authPageClassName` and wrapper/glow markup into one shell used by every auth page. Pages keep only their metadata and their form.

**Contract**: `fonts.ts` exports the font objects/variable class names; `AuthPageShell({ children })` renders the shared wrapper. Route `page.tsx` files become metadata + `<AuthPageShell><XForm /></AuthPageShell>`.

#### 2. Shared styles and layout constants

**Files**: `components/auth/styles.ts`, `app/login/LoginFields.tsx`, `app/signup/SignupFields.tsx`, `app/login/LoginForm.tsx`, `app/signup/SignupForm.tsx`

**Intent**: Export `submitButtonClassName` once and replace the duplicated per-form `styles` objects (`auth-wrap`, `h1`, `sub`, `foot`) with shared exports. The Signup `<div>` to `<h1>` promotion is NOT part of this phase (review F8); do it as a separate step 1.6 after grepping `e2e/` and `__tests__/` for heading locators.

**Contract**: Named exports in `components/auth/styles.ts` (`submitButtonClassName`, `authHeadingClassName`, `authSubtextClassName`, `authFooterClassName`, plus any layout constants). No change to rendered text, labels, roles or test ids.

### Success Criteria:

#### Automated Verification:

- Login and Signup tests pass unchanged: `npx vitest run __tests__/login __tests__/signup --coverage.enabled=false`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Full suite and coverage gates pass: `npm run test:run`

#### Manual Verification:

- `/login` and `/signup` look identical to before in the browser (layout, fonts, buttons, focus rings)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Rate-limit foundation

### Overview

A reusable, storage-agnostic limiter with a durable Postgres adapter.

### Changes Required:

#### 1. Policy constants

**File**: `lib/auth/password-reset-config.ts`

**Intent**: Single home for every named number: IP bucket (capacity 5, refill 12 min), email cooldown (capacity 1, refill 60 s), email hourly (capacity 5, refill 12 min), `MIN_RESPONSE_MS`, `RESEND_COOLDOWN_SECONDS`, `COUNTDOWN_TICK_MS`, limiter scope names.

**Contract**: `RateLimitPolicy = { capacity: number; refillIntervalMs: number }`; constants typed and exported; no literals elsewhere.

#### 2. Pure helpers

**Files**: `lib/auth/client-ip.ts`, `lib/auth/rate-limit-key.ts`, `lib/auth/email.ts`

**Intent**: `getClientIp(headers)` prefers `x-vercel-forwarded-for`, validates with `net.isIP`, returns `"unknown"` otherwise. A test IP header is honored only when `E2E_TEST_HOOKS=1` (injected flag, not read inside the function); the `unknown` bucket uses a looser dedicated policy constant. `normalizeEmail` (trim, NFKC, lowercase) and `isValidEmail` replace the private regex in `app/actions/auth.ts` (which then imports them). `hashRateLimitKey(scope, value, secret)` returns an HMAC hex digest.

**Contract**: Pure functions taking plain inputs (a `Headers`-like object, strings); no `process.env` reads inside them.

#### 3. RateLimiter port and adapters

**Files**: `lib/auth/rate-limiter.ts`, `lib/auth/in-memory-rate-limiter.ts`, `lib/auth/supabase-rate-limiter.ts`

**Intent**: Define the port, an in-memory token-bucket (unit tests/isolated dev only) and a Supabase RPC adapter that takes an injected client.

**Contract**:

```ts
type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };
interface RateLimiter {
  consume(scope: string, keyHash: string, policy: RateLimitPolicy): Promise<RateLimitDecision>;
}
```

The adapter throws a typed `RateLimiterUnavailableError` on RPC failure so the use case can fail closed.

#### 4. Migration, mirrored copy and pgTAP test

**Files**: `supabase/migrations/<timestamp>_create_rate_limit_buckets.sql`, `supabase-test/supabase/migrations/<same>.sql`, `supabase/tests/database/rate_limit_consume.test.sql`, `supabase/migrations/README.md`

**Intent**: Private table `rate_limit_buckets(scope, key_hash, tokens, updated_at, primary key (scope, key_hash))` with RLS enabled and no policies; `consume_rate_limit(p_scope, p_key_hash, p_capacity, p_refill_interval_seconds)` as `SECURITY DEFINER` with pinned `search_path` and schema-qualified names, doing a single atomic upsert that refills by elapsed time, spends one token or returns `retry_after_seconds`, clamps inputs, rejects scopes outside an allow-list and `p_key_hash` longer than a fixed bound (review F4; residual flood risk within the retention window is documented), and deletes rows idle for more than a documented retention period (index on `updated_at`). Execute revoked from `public`, granted to `anon` and `authenticated`.

**Contract**: Returns `table(allowed boolean, retry_after_seconds integer)`. The `supabase test db` CI step is added to the workflow in this phase (review F12); push and read CI before starting Phase 3. `supabase/tests/database/` does not exist yet and is created here; the E2E and pgTAP evidence come from the root project, the `supabase-test/` copy exists only to avoid drift (review F11). pgTAP covers: unknown scope and oversized key rejected, first N allowed then denied, refill after time (controlled via `updated_at`), retry-after value, input clamping, cleanup, and that direct table access is denied for `anon`.

### Success Criteria:

#### Automated Verification:

- Unit tests for the helpers, in-memory limiter and Supabase adapter (mocked client): `npx vitest run __tests__/lib/auth --coverage.enabled=false`
- Coverage gates (90% `lib/auth/**`): `npm run test:run`
- Type checking and lint pass: `npx tsc --noEmit`, `npm run lint`
- Migration applies and pgTAP passes in CI: `supabase db reset && supabase test db` (CI job, Ubuntu)
- Migration copies are identical: `diff supabase/migrations/<file> supabase-test/supabase/migrations/<file>`

#### Manual Verification:

- Review of the RPC against the security checklist (`search_path`, grants, RLS, bounds) by a human

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Reset-request use case, Server Action and Supabase config

### Overview

The behavior core: neutral outcomes, layered limits, minimum response time, and the email contract.

### Changes Required:

#### 1. Minimum-duration helper

**File**: `lib/auth/with-minimum-duration.ts`

**Intent**: Run work and wait out the remainder of a floor using injected `now` and `sleep`, never shortening slower work and never swallowing errors. It levels only limiter-RPC variance; the provider call itself is deferred with `after()` (review F2), with a named provider timeout inside the deferred work.

**Contract**: `withMinimumDuration<T>(work: () => Promise<T>, minimumMs: number, clock: { now(): number; sleep(ms: number): Promise<void> }): Promise<T>`.

#### 2. Use case

**File**: `lib/auth/request-password-reset.ts`

**Intent**: Orchestrate: normalise email, check IP (return `rate_limited` with retry-after), then email cooldown and hourly rules (silent skip), call `resetPasswordForEmail` with the same-origin `redirectTo`, and collapse every provider error and limiter failure to `sent`. Logs only `{code,status}` via `logAuthEvent`.

**Contract**: `requestPasswordReset(deps: { limiter, supabase /* stateless client */, schedule /* wraps after() */, enabled /* PASSWORD_RESET_ENABLED */, hashSecret, siteUrl, clock, log }, input: { email, clientIp }): Promise<{ status: "sent" } | { status: "rate_limited"; retryAfterSeconds: number }>`. All timing flows through `withMinimumDuration`.

#### 3. Server Action

**File**: `app/actions/password-reset.ts`

**Intent**: Thin adapter: parse `FormData`, validate email shape (the only visible error), read `headers()` into `getClientIp`, build real dependencies (server Supabase client, Supabase limiter, env), call the use case and map to state. Configuration/secret errors map to the neutral `sent`.

**Contract**:

```ts
type ForgotPasswordFormState =
  | undefined
  | { error: "invalid_email" }
  | { status: "sent"; email: string }
  | { status: "rate_limited"; retryAfterSeconds: number };
```

Exported action `requestPasswordResetAction(prev, formData)`; the state type lives in `lib/auth/` (not in the `"use server"` file).

#### 4. Supabase configuration and template

**Files**: `supabase/config.toml`, `supabase-test/supabase/config.toml`, `.env.example`, `docs/production-auth.md`

**Intent**: Allow-list `http://127.0.0.1:3000/reset-password` and `…/api/auth/confirm`; raise `auth.rate_limit.email_sent` for the local/test stacks only; retain Supabase's default recovery template; document `RATE_LIMIT_HASH_SECRET`, the hosted redirect allow-list entries, and the Vercel Production variables.

**Contract**: The default Supabase recovery template uses `{{ .ConfirmationURL }}` and receives the `/reset-password` URL through `redirectTo`. The hosted Dashboard template is not changed; the doc lists the exact redirect allow-list entries.

### Success Criteria:

#### Automated Verification:

- Use-case and action tests, including the byte-identical neutral-output assertion across registered/unknown/email-limited/provider-429/provider-error/limiter-failure: `npx vitest run __tests__/lib/auth __tests__/actions --coverage.enabled=false`
- Validation tests assert the provider and limiter are not called for invalid email
- Minimum-duration tests use fake clock (no wall-clock equality)
- Deferred-send tests: provider error (including 429) and a thrown exception are caught inside the scheduled callback, logged only as `{code,status}`, and never rethrown; the injected `schedule` is given a callback that resolves even on failure
- Flag-off test: no limiter or provider call, neutral `sent`; provider call is scheduled via the injected `schedule`, no cookies written
- Secret validation test: missing/short secret logs the distinct code and returns `sent`
- Coverage gates: `npm run test:run`
- Type checking and lint: `npx tsc --noEmit`, `npm run lint`
- Config parses (Supabase starts) in CI: `supabase start`

#### Manual Verification:

- Hosted Supabase Dashboard redirect URLs updated; the default recovery template remains unchanged (human-only step)
- `RATE_LIMIT_HASH_SECRET` set in Vercel Production

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Forgot Password UI

### Overview

Accessible screens that only render action state, matching mockup 00.3 / 00.3b / 00.3c.

### Changes Required:

#### 1. Route and flow

**Files**: `app/forgot-password/page.tsx`, `app/forgot-password/ForgotPasswordFlow.tsx`

**Intent**: A public route (outside `(protected)`) using `AuthPageShell`. `ForgotPasswordFlow` uses `useActionState` and switches among the form, sent and limited screens; "Use a different email" returns to an empty form via local state.

**Contract**: Pure presentational screens receive props only; the flow owns the state machine.

#### 2. Screens and fields

**Files**: `app/forgot-password/ForgotPasswordForm.tsx`, `CheckYourEmailScreen.tsx`, `TooManyRequestsScreen.tsx`, `ResendLinkForm.tsx`

**Intent**: Form with labelled email (`autoComplete="email"`, `aria-invalid` + `aria-describedby` on error, pending/disabled button). Sent screen: `role="status"` message, email chip, steps, Back to Log In, a Resend form (hidden email field, re-runs the same action) disabled during the 60 s cooldown. Limited screen: `role="alert"`, wait card with the countdown, disabled "Request a New Link" until it ends. Mockup-only items (example-state block, divider) are not built.

**Contract**: Reuse shared styles; add the missing pieces (status ring, email chip, field error, secondary-on-dark button, wait card) to `components/auth/styles.ts` or small shared components, with a contrast-checked token for the `#f3c47a` label.

#### 3. Countdown hook

**File**: `lib/hooks/use-countdown.ts` (or `components/auth/use-countdown.ts`)

**Intent**: Count down from N seconds with an injected tick interval; expose `secondsLeft`, `isFinished` and a `m:ss` formatter. The visible timer is `aria-hidden`; a visually hidden live region announces only on state change (finished), never each tick.

**Contract**: `useCountdown(seconds: number, tickMs = COUNTDOWN_TICK_MS)`; formatting as a pure function.

#### 4. Focus management and a11y

**Intent**: On screen change, move focus to the new `<h1>` (`tabIndex={-1}`); all controls keyboard reachable; decorative SVGs `aria-hidden`; verify white/50 hint and footer contrast meet WCAG AA, raising opacity or tokens if not.

### Success Criteria:

#### Automated Verification:

- Component tests for each screen, the flow transitions, resend cooldown, `aria-invalid`/`role` attributes and focus move: `npx vitest run __tests__/forgot-password --coverage.enabled=false`
- Hook test with fake timers (`useCountdown`, formatter)
- The Login "Forgot password?" link test still passes (`__tests__/login/LoginForm.test.tsx`), with new cases for the flag on and off (link hidden when off)
- `__tests__/protected-pages-guard.test.ts` still passes (route is not in `(protected)`)
- Coverage gates, type checking, lint: `npm run test:run`, `npx tsc --noEmit`, `npm run lint`

#### Manual Verification:

- Screens match mockup 00.3 / 00.3b / 00.3c (spacing, colours, fonts)
- Keyboard-only walkthrough and a screen-reader pass for status/alert announcements and focus
- Mobile width layout is usable

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: CI E2E, docs and evidence

### Overview

Prove provider behavior and the full flow in the authoritative environment.

### Changes Required:

#### 1. Mail-capture helper

**File**: `e2e/helpers/auth-email.ts`

**Intent**: Find messages by recipient, poll until delivery with a named timeout, read the body, extract the recovery URL and delete test messages. The capture service endpoint (Inbucket vs Mailpit for CLI 2.117.0) is resolved on the first CI run and held in one constant/env var.

**Contract**: `waitForRecoveryEmail(recipient): Promise<{ recoveryUrl: string }>`; `clearMailbox(recipient)`.

#### 2. Specs

**File**: `e2e/forgot-password.spec.ts`

**Intent**: Cover: registered email reaches Check Your Email and a recovery email is captured; unknown email shows the identical state with no email; repeated provider responses (separate from happy path) stay neutral for both categories; IP-limit exhaustion shows Too Many Reset Requests with a countdown; the captured default recovery link redirects to the reset page in a fresh browser context; mailbox timeout/cleanup. Unique timestamped emails; service-role admin client for seeding. Each spec uses a unique IP via the test header (`E2E_TEST_HOOKS=1`); one reserved IP is used only for the exhaustion spec. The webServer env sets `PASSWORD_RESET_ENABLED=1`.

**Contract**: Reuse existing `e2e/helpers/*` conventions; set `RATE_LIMIT_HASH_SECRET` and (if needed) a test IP header in `playwright.config.ts` webServer env.

#### 3. Workflow and docs

**Files**: `.github/workflows/playwright.yml`, `docs/production-auth.md`, `context/changes/request-password-reset-email/change.md`

**Intent**: Add a `supabase test db` step before Playwright; document in the change that decisions live in `research.md`/`plan.md` and list the Story 0.7 hand-offs (confirm handler, recovery-session classification, post-success behavior, link 404 until then); record any local/CI/hosted config differences found.

### Success Criteria:

#### Automated Verification:

- CI workflow green on the branch (unit tests, `supabase test db`, Playwright); run ID recorded in the plan Progress notes and PR
- Playwright report artifact uploaded (existing step)
- Lint and typecheck still pass locally: `npm run lint`, `npx tsc --noEmit`

#### Manual Verification:

- Human review of the Playwright report and CI logs for provider 429 codes and unknown-vs-known parity
- Hosted environment smoke after Story 0.7 lands (not before)

---

## Testing Strategy

### Unit Tests:

- `getClientIp` (valid/invalid/missing/multi-hop), `normalizeEmail`/`isValidEmail`, `hashRateLimitKey` determinism and scope separation
- In-memory limiter refill and retry-after; Supabase adapter success/error mapping
- `withMinimumDuration` with a fake clock (fast work waits, slow work unchanged, errors propagate)
- Use case: IP denied, email cooldown denied, hourly denied, provider success/error/429, limiter unavailable, missing secret; neutral-output parity; provider not called when email-limited
- Action: invalid email, state mapping, headers read

### Integration Tests:

- pgTAP for the RPC and table privileges (CI)
- Playwright flows listed in Phase 5 (CI)

### Manual Testing Steps:

1. Run `npm run dev`, open `/login`, click Forgot password?, submit an invalid email, then a valid one, and confirm the Check Your Email screen
2. Tab through every screen; confirm focus moves to the heading on each state change
3. Submit repeatedly (after local Supabase is available) to see the IP limit screen and countdown
4. Check contrast of hint and footer text with a checker

## Performance Considerations

One RPC call per limiter rule (up to three per request) plus one provider call; acceptable for MVP traffic. `MIN_RESPONSE_MS` holds a function instance slightly longer by design. The RPC's cleanup is bounded by an indexed delete.

## Migration Notes

New migration must be copied to `supabase-test/` in the same change. Hosted Supabase needs the migration applied and the redirect URLs set manually; keep the default recovery email template; Vercel needs `RATE_LIMIT_HASH_SECRET`. Rollback: drop the RPC and table; the app then fails closed (neutral `sent`, no emails) rather than erroring.

## References

- Related research: `context/changes/request-password-reset-email/research.md`
- Change: `context/changes/request-password-reset-email/change.md`
- Similar implementation: `app/actions/auth.ts` (action conventions), `__tests__/actions/auth.test.ts` (mocking pattern)
- Design source: `supabase/docs/nextjoblog-mvp-screens.html:1617-1721`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared auth primitives (no behavior change)

#### Automated

- [x] 1.1 Login and Signup tests pass unchanged — 4f3bad0
- [x] 1.2 Type checking passes — 4f3bad0
- [x] 1.3 Linting passes — 4f3bad0
- [x] 1.4 Full suite and coverage gates pass — 4f3bad0
- [x] 1.6 Signup heading promoted to h1 as a separate step (e2e/unit locators checked first) — 4f3bad0

#### Manual

- [x] 1.5 /login and /signup look identical to before in the browser — 4f3bad0

### Phase 2: Rate-limit foundation

#### Automated

- [x] 2.1 Unit tests for helpers, in-memory limiter and Supabase adapter pass — feb63e6
- [x] 2.2 Coverage gates pass (90% lib/auth) — feb63e6
- [x] 2.3 Type checking and lint pass — feb63e6
- [x] 2.4 Migration applies and pgTAP passes in CI — feb63e6
- [x] 2.5 Migration copies in supabase and supabase-test are identical — feb63e6

#### Manual

- [x] 2.6 RPC reviewed against the security checklist — feb63e6

### Phase 3: Reset-request use case, Server Action and Supabase config

#### Automated

- [x] 3.1 Use-case and action tests pass, including neutral-output parity
- [x] 3.2 Validation tests assert provider and limiter are not called for invalid email
- [x] 3.3 Minimum-duration tests pass with a fake clock
- [x] 3.4 Coverage gates pass
- [x] 3.5 Type checking and lint pass
- [x] 3.6 Local Supabase starts with the new config in CI

#### Manual

- [x] 3.7 Hosted Supabase recovery template and redirect URLs updated
- [x] 3.8 RATE_LIMIT_HASH_SECRET set in Vercel Production
- [x] 3.9 PASSWORD_RESET_ENABLED left off in Production until Story 0.7 ships

### Phase 4: Forgot Password UI

#### Automated

- [ ] 4.1 Component tests for screens, flow transitions, resend cooldown, ARIA and focus pass
- [ ] 4.2 useCountdown hook tests pass with fake timers
- [ ] 4.3 Login forgot-password link test and protected-pages guard test still pass
- [ ] 4.4 Coverage gates, type checking and lint pass

#### Manual

- [ ] 4.5 Screens match mockups 00.3, 00.3b and 00.3c
- [ ] 4.6 Keyboard-only and screen-reader walkthrough passes
- [ ] 4.7 Mobile layout is usable

### Phase 5: CI E2E, docs and evidence

#### Automated

- [ ] 5.1 CI workflow green (unit tests, supabase test db, Playwright) with run ID recorded
- [ ] 5.2 Playwright report artifact uploaded
- [ ] 5.3 Lint and typecheck pass locally

#### Manual

- [ ] 5.4 Playwright report and CI logs reviewed for provider 429 and unknown-vs-known parity
- [ ] 5.5 Hosted smoke test after Story 0.7 lands
