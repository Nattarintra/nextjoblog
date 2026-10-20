---
date: 2026-10-17T00:00:00+02:00
researcher: Natta
git_commit: d5fac67b3d4d6fa02b05d9f59946e342514a4159
branch: feat/request-password-reset-email
repository: nextjoblog
topic: "Request a password reset email (Story 0.6): forgot-password, check-your-email and too-many-requests screens"
tags: [research, codebase, auth, forgot-password, password-reset, rate-limit, supabase, nextjs-16, tailwind, a11y, testing]
status: complete
last_updated: 2026-10-17
last_updated_by: Natta
---

# Research: Request a password reset email (Story 0.6)

**Date**: 2026-10-17
**Researcher**: Natta
**Git Commit**: d5fac67b3d4d6fa02b05d9f59946e342514a4159
**Branch**: feat/request-password-reset-email
**Repository**: nextjoblog

## Research Question

Research how to build `request-password-reset-email`. Inputs:

- `change.md` and `supabase/docs/` (schema and the MVP screens HTML).
- Design source: `nextjoblog-mvp-screens.html` lines 1617-1721 (00.3 Forgot Password, 00.3b Check Your Email, 00.3c Too Many Requests).
- Quality bar: at least 80% test coverage, SOLID, clean code, maintainability, extensibility, testability, reusability, a11y, and Next.js and Tailwind project-structure best practice.

## Summary

The route plumbing is already in place. The feature itself is not, and four areas need design decisions.

**Already in place**

- `/forgot-password` and `/reset-password` are registered as public paths (`lib/auth/paths.ts:6-12`).
- The login page already links to `/forgot-password` (`app/login/LoginFields.tsx:51-55`) and a test asserts it (`__tests__/login/LoginForm.test.tsx:37`). Until the page exists, that link 404s.
- There is no `resetPasswordForEmail` call, no action, no page, no `/auth/*` handler, no rate limiter and no IP reading anywhere in the repo.

**Findings that change the design**

1. **Anti-enumeration is not automatic.**
   - Supabase `/recover` is documented to return success for unknown emails (unverified locally, see Open Questions).
   - A rate-limit error appears only after a real send. If that error is surfaced, it leaks which accounts exist.
   - The action must return one neutral outcome for success, unknown email and provider failures. The only visibly different outcome is the IP-level "too many requests" state.
2. **Supabase's built-in rate limits cannot drive the "try again in 14:52" screen.**
   - `email_sent = 2/hour` is project-wide, not per email or per IP.
   - Calls come from the server, so Supabase sees the server IP, not the user's.
   - auth-js exposes no retry-after, only the error message text.
   - The countdown therefore needs an app-level limiter that knows its own window. This is the biggest open design decision.
3. **PKCE binds the reset link to the browser that requested it.**
   - `@supabase/ssr` forces PKCE and stores the verifier in a cookie.
   - Opening the emailed link on a phone while requesting on a laptop fails.
   - The `token_hash` flow (`/auth/confirm` plus a custom `recovery` email template) avoids this, but it is Story 0.7's concern. The 0.6 choice of `redirectTo` constrains it.
4. **Local and hosted config need changes.**
   - Local `additional_redirect_urls` does not allow-list the reset or confirm URL.
   - `email_sent = 2` makes local manual testing and E2E hit the limit quickly.
   - Hosted limits are set in the dashboard, not in code.

**Design and test constraints**

- The mockup screens map onto the existing auth shell. About half the CSS is already available as Tailwind tokens and class strings, and the rest (status ring, email chip, wait card, secondary-on-dark button, field error, countdown) is new.
- Vitest enforces 80% global and 90% for `lib/auth/**`. Pure logic should live in `lib/auth/` with injected dependencies, which also satisfies the testability requirement.

## Detailed Findings

### 1. Requirements (`change.md`)

`context/changes/request-password-reset-email/change.md` defines:

- **Happy path**: a registered email gets a reset link.
- **Edge**: repeated requests for the same email return the same generic confirmation every time.
- **Error**: an unknown email gets "If this email exists in our system, we've sent a link", with no leak.
- **Non-functional**: rate-limit by email or IP above a threshold. The threshold is not defined.
- **Out of scope**: SMS or any non-email channel.
- **Open questions**: "None". The mockup notes (see section 4) contain real open questions.

### 2. Existing auth patterns to mirror

**Structure** (flat folder per public auth route, colocated PascalCase components, kebab-case logic):

- Signup: `app/signup/{page,SignupForm,SignupFields,PasswordField,SignupAlerts}.tsx` plus `password-validation.ts`.
- Login: `app/login/{page,LoginForm,LoginFields,LoginAlert,ReturnStrip}.tsx`.
- Shared UI: `components/auth/AuthLogo.tsx` and `components/auth/styles.ts`.
- Server-side helpers: `lib/auth/*` and `lib/supabase/{server,config}.ts`.
- Group conventions: `(protected)` is a route group and `_components` is a private folder, in line with the Next project-structure docs. A new `app/forgot-password/` fits the existing public pattern. It must stay out of `(protected)`, because `__tests__/protected-pages-guard.test.ts` requires `requireSession()` there.

**Server action convention** (`app/actions/auth.ts`):

- The file starts with `"use server"`, so it can only export async functions. Shared constants and regexes therefore cannot be exported from it.
- Signature `(prevState, formData) => Promise<State>` (`signup` at lines 61-65, `login` at 134-137), used with `useActionState(action, undefined)`.
- Return shape is an exported discriminated union: `{ error: <code> }` for errors and `{ status: <code> }` for success.
- `redirect()` is called outside the try/catch.
- Input parsing: `typeof v === "string" ? v.trim() : ""`. The email regex is `emailShapePattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` at line 11. It is not exported and not shared with the client.
- Error mapping uses `isAuthApiError` predicates (lines 37-51). `SupabaseConfigError` maps to `{ error: "configuration" }`. Anything else becomes `{ error: "unknown", message }`.
- Logging: `logAuthEvent(AUTH_LOG_EVENT.x, describeAuthError(error))` logs only `{code, status}` (`lib/auth/log.ts`, `lib/auth/error-details.ts`). Raw errors, form data and config messages are never logged.
- Validation tests assert the provider is not called when input is invalid.

**Duplication** (a reuse opportunity):

- `page.tsx` of login and signup both repeat the `Archivo`/`Work_Sans` font setup, the `authPageClassName` and the metadata pattern.
- The `*Form.tsx` files repeat a local `styles` object (`SignupForm.tsx:19-25`, `LoginForm.tsx:15-21`).
- `submitButtonClassName` is duplicated in `SignupFields.tsx:6-7` and `LoginFields.tsx:6-7`.
- Adding a third copy would be wrong. The new route should extract these into `components/auth/` or reuse them.
- Extracting them from login and signup is a refactor outside this change. Decide the scope in planning.

**Heading inconsistency**: login uses `<h1>`, signup uses a `<div>`. Use `<h1>` for the new screens.

### 3. Supabase behaviour

**`resetPasswordForEmail`** (`node_modules/@supabase/auth-js/src/GoTrueClient.ts:4446-4480`):

- Signature: `(email, { redirectTo?, captchaToken? }) → { data: {}, error: null } | { data: null, error: AuthError }`.
- It POSTs `/recover`, passing `redirectTo` as a query parameter. In PKCE mode it also sends a code challenge and stores the verifier in the client's storage.
- `@supabase/ssr` forces `flowType: "pkce"` (`createServerClient.ts:170`). `createServerSupabaseClient` (`lib/supabase/server.ts`) therefore stores a verifier cookie when it is called from a Server Action.

**Unknown email**: GoTrue returns 200 with no email sent. This is documented Supabase behaviour but was not verified against the local stack. See Open Questions.

**Remaining enumeration channels**:

- Timing, since a real send is slower than a no-op.
- A per-user rate-limit error (`over_email_send_rate_limit`) appears only after a real send.
- Invalid email format returns a 400.

The action must therefore map success, unknown email, `over_email_send_rate_limit`, `over_request_rate_limit` (when it comes from Supabase rather than the app limiter) and provider failures to one neutral outcome. It logs the real code server-side only.

**Rate-limit error detection**: `isAuthApiError(error) && error.status === 429` with `error.code` of `over_email_send_rate_limit` or `over_request_rate_limit` (`auth-js/src/lib/error-codes.ts:71-72`). `max_frequency` also returns 429 with `over_email_send_rate_limit`. No retry-after is exposed (`errors.ts`, `fetch.ts`).

**Config** (`supabase/config.toml`; `supabase-test/supabase/config.toml` is a manual copy that drifts):

- `site_url = "http://127.0.0.1:3000"` (line 158) and `additional_redirect_urls = ["https://127.0.0.1:3000"]` (line 162). Redirect URLs are matched exactly, and the entry is https while the site is http. An `http://127.0.0.1:3000/...` reset or confirm URL is not allow-listed. This needs a change in both config files, plus the hosted dashboard and Vercel production URLs.
- `[auth.rate_limit] email_sent = 2` per hour (lines 196-210). It is project-wide. The config comment says it requires custom SMTP, and whether it is enforced against local inbucket is unverified.
- `[auth.email] max_frequency = "1s"` (line 229), `otp_expiry = 3600` (the reset link lasts 1 hour), `secure_password_change = false`.
- `[auth.captcha]` is commented out, so `captchaToken` does nothing.
- Email templates are all commented out, so `recovery` uses the Supabase default `{{ .ConfirmationURL }}`.
- `[inbucket]` is enabled (line 104; web UI port 54324 per the test config).
- `NEXT_PUBLIC_SITE_URL` is listed in `.env.example` and `docs/production-auth.md:19` but is not read anywhere in `app/`, `lib/` or `components/`. It is the natural source for `redirectTo` (the mockup dev note uses `origin + '/reset-password'`). The service-role key is used only in e2e, and `.env.example` says it must never be a production app env var.

**Follow-up page (Story 0.7) interaction**:

- _Code flow_ (default template): `redirectTo` receives `?code=...`. A route handler calls `exchangeCodeForSession(code)`, then the page calls `updateUser({ password })`. It needs the same browser.
- _`token_hash` flow_: a `/auth/confirm` handler calls `verifyOtp({ type: "recovery", token_hash })`. It works across devices but needs a custom `[auth.email.template.recovery]`.
- No `/auth/*` route exists, and `/auth` is not in the public prefixes (`lib/auth/paths.ts`). A handler there would be redirected to login unless it is added to the prefixes or placed under `/api/auth/`.
- Whether a recovery session fits the app's session-extension and timebox logic (`lib/session/*`) is not checked.

### 4. Design source (`nextjoblog-mvp-screens.html` 1617-1721)

**Screens**:

- **00.3 `scr-forgot`**:
  - h1 "Forgot Your Password?", sub text, and an email field (`id=fp-email`).
  - Hint "The link works once. You'll set your new password on the page it opens."
  - Primary "Send Reset Link", and a footer "← Back to Log In".
  - Mockup-only items, not for production: the `auth-divider` and `state-label` "Example state" block (an invalid-email example with `aria-invalid="true"`, `aria-describedby="fp-err"` and the message "Enter a valid email address, like you@example.com").
- **00.3b `scr-forgot-sent`**:
  - An info `status-ring` with a mail icon, h1 "Check Your Email", and the sub as `role="status"`: "If this email exists in our system, we've sent a link."
  - An `email-chip` showing the submitted address, and three `status-step`s.
  - A primary "Back to Log In", and a disabled secondary "Resend Link in 0:45" (`data-countdown="45"`).
  - A footer "Use a different email".
- **00.3c `scr-forgot-limited`**:
  - A warn `status-ring` with a clock icon, h1 "Too Many Reset Requests", and the sub as `role="alert"`.
  - A `wait-card` with "You can try again in" and a countdown (`892` s = 14:52), plus a note that any link already sent still works.
  - A primary "Back to Log In", and a disabled secondary "Request a New Link" (`data-cd-target="#lim-cd"`).
  - A mono footer "Same message for every email address".

**Dev notes in the screens JS (around lines 2755-2757)**:

- Call `resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`.
- Prefill the email via client state, not the URL.
- Show a spinner and disable the button while the request runs.
- Any non-429 response, including "user not found", goes to Check Your Email.
- Keep the loading-to-screen transition the same length for every response.
- Only a 429 goes to Too Many Requests.
- "Use a different email" returns to the form with the field cleared.
- Resend cooldown is 60 s in production (45 s is shown in the mockup).
- Rate-limit threshold is undefined in the story. The example is 5 per hour per IP.
- Check whether Supabase throttles unregistered emails the same way as registered ones. If it does not, a per-email 429 would reveal the account exists, so treat the per-email 429 as success and surface only the IP-level limit.
- Open product question: tell the user once the limit is hit (what the mockup assumes), or keep showing "Check Your Email" and silently skip sending.

**Countdown JS** (lines 2850-2878): a 1 s `setInterval` per `[data-countdown]` element. It formats `m:ss`, never goes below 0, enables the button at 0 and removes the `.cd-wrap` text. There is no counterpart in the app. A small `useCountdown(seconds)` hook fits.

**CSS reuse map** (mockup CSS at lines 729-1065, against `components/auth/styles.ts` and `app/globals.css`):

| Mockup class                                                                          | Status in app                                                                                  |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `.auth-field label`, `input`, `.auth-link`                                            | Exist: `authFieldLabelClassName`, `authInputClassName`, `authLinkClassName`                    |
| `.btn` primary                                                                        | `submitButtonClassName`, duplicated and unexported in `LoginFields.tsx` and `SignupFields.tsx` |
| colours (navy, sky, azure, `auth-label`, `auth-danger`, warning/danger/success tints) | Exist as tokens in `globals.css`                                                               |
| `.auth-wrap`, `.auth-glow`, `.auth-h1`, `.auth-sub`, `.auth-foot`                     | Inline in each Form's `styles` object. Reuse or extract                                        |
| `.status-step` and `.n`                                                               | Close to `.session-steps` / `.session-step` in `globals.css`                                   |
| `.status-ring` (info and warn), `.email-chip`, `.auth-hint`                           | Missing                                                                                        |
| `.field-err` (with the "!" glyph), `.auth-field.invalid`                              | Missing                                                                                        |
| `.btn-secondary.btn-on-dark`, disabled style (opacity .45)                            | Missing. Login uses `disabled:cursor-wait disabled:opacity-70`                                 |
| `.wait-card`, `.wait-label`, `.wait-time`, `.wait-note`                               | Missing, and the `#f3c47a` label colour has no token                                           |
| `.btn-stack`, `.auth-divider`, `.cd`                                                  | Trivial utilities: `flex flex-col gap-2.5`, `h-px bg-white/12`, `tabular-nums`                 |

Fonts: the mockup uses IBM Plex Mono for chips and labels. The app has `--font-geist-mono`. Per-page fonts (`Archivo`, `Work_Sans`) are loaded per page, so the new page must load them as well.

### 5. Rate-limiting options

Nothing exists in the repo. `package.json` has no limiter dependency. Next's docs ship only a stub `checkRateLimit` (`02-guides/backend-for-frontend.md:783-800`) and recommend rate limiting for email-sending actions (`data-security.md:476-478`, `production-checklist.md:102`).

| Option                                        | Per-email                       | Per-IP             | Retry-after   | Cost                                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------- | ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Supabase built-in only                     | `max_frequency` approximates it | Sees the server IP | No            | Zero code. `email_sent` is a shared pool, so one attacker can exhaust it for everyone                                                                                                                  |
| 2. In-memory map                              | Yes                             | Yes                | Yes           | Per-instance only and lost on cold start. The `lib/supabase/config.ts` comment warns Proxy and Actions may run in different tiers. Best-effort only                                                    |
| 3. Postgres table plus `SECURITY DEFINER` RPC | Yes (hash the key)              | Yes                | Yes           | New migration, duplicated into `supabase-test/` (`supabase/migrations/README.md` warns about drift). RLS must block the table, and the RPC needs cleanup. Fits the stack and avoids a service-role key |
| 4. Upstash Redis plus `@upstash/ratelimit`    | Yes                             | Yes                | Yes (`reset`) | New dependency, account and env vars, and a local and E2E fallback                                                                                                                                     |
| 5. Host WAF (Vercel)                          | No                              | Yes                | Limited       | Host-specific. A backstop only                                                                                                                                                                         |

The leading approach is a limiter behind an interface (a `RateLimiter` port) so the store can change without touching the action: option 3 or 4 for real enforcement, option 2 as the unit-test and dev implementation. Supabase's own limits stay as the backstop.

Client IP: `(await headers()).get("x-forwarded-for")`, taking the first hop. `headers()` is async in Next 16 (`03-api-reference/04-functions/headers.md`). It is spoofable unless the host overwrites it. The deployment target is not specified beyond ".env.example mentions Vercel Production". No IP reading exists today, and the only `headers()` use is `lib/auth/request-path.ts`. Pure parsing of the IP header belongs in a testable function in `lib/auth/`.

### 6. Testing infrastructure

- **Vitest** (`vitest.config.mts`): jsdom, include `__tests__/**/*.test.{ts,tsx}`, coverage always on (v8). Global thresholds are 80% (lines, statements, functions, branches), and `lib/auth/**` has 90%. Excluded: `proxy.ts`, `lib/supabase/server.ts`, `lib/auth/request-path.ts`. Focused runs need `--coverage.enabled=false`, otherwise they fail the thresholds.
- **Layout**: `__tests__/` mirrors the source tree (`actions/`, `login/`, `signup/`, `lib/auth/`, `api/auth/`, ...).
- **Action tests** (`__tests__/actions/auth.test.ts`):
  - `vi.hoisted` mocks plus `vi.mock("@/lib/supabase/server")` and `vi.mock("next/navigation")`.
  - Provider errors are built with `new AuthApiError(msg, status, code)`.
  - Config failure uses `SupabaseConfigError("missing_url")`.
  - Validation tests assert the provider was not called.
- **Form tests** (`__tests__/login/LoginForm.test.tsx`, `__tests__/signup/SignupForm.test.tsx`): mock `useActionState` and `next/link`. Queries use `getByLabelText`, `getByRole("alert")` and `aria-invalid`.
- **Playwright** (`playwright.config.ts`, `scripts/run-e2e.mjs`):
  - Needs a running local Supabase. `workers: 1`.
  - webServer env `SESSION_TIMEBOX_MS=30000 E2E_TEST_HOOKS=1`.
  - Helpers in `e2e/helpers/`. Specs use timestamped emails (`test+${Date.now()}@example.com`) and a service-role admin client.
  - There is no inbucket or mail-reading helper. E2E of the real reset link needs one. The endpoint depends on the CLI version (Inbucket vs Mailpit) and was not checked.
  - CI is `.github/workflows/playwright.yml`.
- **Component hook testing**: a countdown hook is testable with fake timers and `@testing-library/react`.

### 7. Accessibility patterns in use

- `<label htmlFor>` with the input `id` and `name`, `required`, `aria-invalid`.
- Alerts use `role="alert"` and `data-testid` (`SignupAlerts.tsx`, `LoginAlert.tsx`). The success banner uses `role="status"` (`LoginLoggedOutAlert`). Check Your Email maps to `role="status"` and Too Many Requests to `role="alert"`, as in the mockup.
- Decorative SVGs are `aria-hidden`, and the logo is `aria-label="NextJobLog"`.
- Gaps to close in the new screens:
  - No `autoComplete` on any field. The mockup has `autocomplete="email"`.
  - Helper text is not linked through `aria-describedby`.
  - There is no programmatic focus management when the screen state changes (form to sent to limited).
  - A visible countdown must not announce every second to screen readers. Announce on state change, not per tick.
  - Contrast: the white/50 hint text and `rgba(255,255,255,.4)` footer on navy should be checked against WCAG AA.

## Code References

- `lib/auth/paths.ts:6-14` - `/forgot-password` and `/reset-password` already public
- `lib/auth/route-access.ts:13-26` - `isPublicPath` and `decideRouteAccess`
- `app/login/LoginFields.tsx:51-55` - existing "Forgot password?" link
- `app/actions/auth.ts:11,22-35,37-51,61-137,134-194` - email regex, state unions, error predicates, signup and login actions
- `app/signup/SignupForm.tsx:19-65` and `app/login/LoginForm.tsx:15-57` - Form structure, `styles` object, `useActionState`
- `components/auth/styles.ts` - input, label and link class strings
- `app/globals.css:3-39` - colour tokens and `@theme inline`
- `lib/auth/log.ts`, `lib/auth/error-details.ts` - safe logging
- `lib/supabase/server.ts:7-27`, `lib/supabase/config.ts` - server client, `SupabaseConfigError`
- `lib/auth/request-path.ts:6` - the only `headers()` use today
- `proxy.ts:19,107-111` - Next 16 proxy file and matcher
- `supabase/config.toml:104,158,162,196-210,218-233` - inbucket, site_url, redirect URLs, rate limits, email settings
- `node_modules/@supabase/auth-js/src/GoTrueClient.ts:4446-4480` - `resetPasswordForEmail`
- `node_modules/@supabase/auth-js/src/lib/error-codes.ts:71-72` - rate-limit error codes
- `supabase/docs/nextjoblog-mvp-screens.html:1617-1721` - three screens; `:729-1065` CSS; `:2755-2757` dev notes; `:2850-2878` countdown JS
- `vitest.config.mts` - thresholds and excludes
- `__tests__/actions/auth.test.ts:4-45` - action mocking pattern
- `e2e/signup.spec.ts`, `e2e/helpers/auth-session.ts` - E2E conventions

## Architecture Insights

- **Layering that works here**: pure, injected logic in `lib/auth/` (90% gate). A thin Server Action in `app/actions/` that parses input, calls the use case and maps the result to a state. Client components only render state. This keeps each unit testable and replaceable.
- **Suggested units** (a proposal for the plan, not yet decided):
  - Email validation: a shared pure module, replacing the private regex in `auth.ts`.
  - Client IP extraction: a pure function over a `Headers`-like input.
  - A `RateLimiter` interface with swappable implementations (open for extension, closed for modification).
  - A password-reset request use case with injected Supabase client and limiter. It returns a closed result type (`sent` | `rate_limited`, with retry-after seconds). Provider failures collapse to `sent`.
  - A `useCountdown` hook.
  - Presentational screens: form, sent, limited. `ForgotPasswordFlow` switches between them from the action state.
  - Shared auth shell and button or status styles in `components/auth/`.
- **Named constants** (no magic numbers): resend cooldown (60 s), rate-limit window and threshold, and the countdown tick interval. They sit in a config module next to `lib/session/config.ts`'s style.
- **Single neutral outcome** is the core security invariant. A test should assert identical output and the same screen for registered, unregistered and provider-error cases.
- **Timing equalisation**: the mockup notes want the same transition length for every response. The action can enforce a minimum response time, or the UI can use a fixed delay. Pick one in the plan.
- **Do not duplicate the font or page-shell code a third time**. Extract it, or accept the duplication consciously.

## Historical Context (from prior changes)

- `context/archive/2026-09-07-log-in-an-existing-account/` - generic `invalid_credentials` handling, identical UI for wrong email and wrong password, and the E2E that compares both. Relied on Supabase's built-in rate limit with no dedicated state, which is why 0.6 differs.
- `context/changes/sign-up-for-a-new-account/` - action and `useActionState` conventions, boundary validation (review F5), page fonts scoped per page, profile created by an auth trigger.
- `context/changes/redirect-unauthenticated-users/` - registered `/forgot-password` and `/reset-password` as public and explicitly left the pages out of scope. `resolvePostLoginPath` already rejects `?next=/reset-password`.
- `context/changes/fix-expired-session-local-sign-out/` - lessons:
  - Log only code and status.
  - Put a named timeout on provider calls (5 s).
  - Keep Vitest focused runs `--coverage.enabled=false`.
  - Check E2E locators against the real copy.
  - Don't link to routes that don't exist.
  - Record CI run IDs as evidence.
- `context/archive/2026-09-21-diagnose-production-auth-failure/research.md:20` - `supabase/config.toml` only configures the local stack. Hosted Auth config drifts and must be set in the dashboard.
- No Story 0.7 change folder exists. Only the `scr-reset` mockup (around lines 1722-1760) and mentions in these notes.
- `context/foundation/lessons.md` does not exist.

## Related Research

- `context/archive/2026-09-07-log-in-an-existing-account/research.md`
- `context/changes/sign-up-for-a-new-account/research.md`
- `context/changes/redirect-unauthenticated-users/research.md`

## Open Questions

1. **Rate-limit policy — mostly decided; per-email ceiling pending**: use a layered policy. The application-level IP limiter uses a token bucket with a capacity of 5 requests and refills 1 request every 12 minutes (equivalent to 5 requests/hour over time). Exceeding the IP limit is the only condition that shows the `Too Many Reset Requests` screen. Add a per-email cooldown of 1 request per 60 seconds; the plan must still make the hourly per-email ceiling explicit rather than leaving it optional. Email-level violations are silent, skip the provider call, and still return the neutral `Check Your Email` outcome so they cannot reveal whether the account exists. The resend cooldown is 60 seconds. Supabase's built-in limits remain a backstop, not the source of the UI countdown. The limiter should be behind a `RateLimiter` interface so the store can be changed later. See **Decision: Rate-limit policy** below.
2. **Show or hide the limit state — decided**: show **Too Many Reset Requests** only when the application-level IP limit is exceeded. Email-level limits remain silent and return the neutral **Check Your Email** state, so they cannot reveal whether the submitted address has an account. This decision keeps the mockup's limited screen while preserving anti-enumeration. See **Decision: limit-state visibility** below.
3. **Limiter store — decided**: use a Supabase Postgres table plus an atomic RPC as the durable production store. Keep the `RateLimiter` interface so the storage can change later. Use an in-memory implementation only for unit tests and isolated development. See **Decision: limiter store** below.
4. **Reset link flow — token type decided; exact route pending**: use the `token_hash` flow so the reset link can be opened on a different device or browser. Keep Story 0.6 focused on requesting and sending the reset email; Story 0.7 owns the confirmation handler, token verification, the reset-password page, and `updateUser({ password })`. The recommended handler route is `/api/auth/confirm` because `/api/auth` is already public, but the exact route and email-template URL contract must be fixed in the plan. See **Decision: reset-link flow and story boundary** below.
5. **Does Supabase throttle unregistered emails like registered ones — policy decided, provider behavior pending verification**: treat every provider-level email or user rate-limit response as the neutral `Check Your Email` result. Only the application-level IP limiter may render `Too Many Reset Requests`. The real Supabase behavior must be verified with E2E tests in GitHub Actions/CI because Chromium is not supported in the current macOS 13 environment. See **Decision: provider rate-limit neutrality and E2E verification** below.
6. **Local E2E — decided**: use the local Supabase email-capture service, add a polling mail-reading helper, and raise the email quota only in local/test configuration. Add E2E coverage for captured `token_hash` links, known versus unknown emails, application IP limiting, and cross-browser recovery. GitHub Actions/CI on Ubuntu is the authoritative browser runner because the current macOS 13 environment does not support the project's Chromium-based Playwright run. See **Decision: local E2E email capture and CI verification** below.
7. **Deployment target and IP trust — decided**: the live site runs on Vercel Production and syncs from the `main` branch. `.env.example` is only a variable-name template; production must use Vercel Production Environment Variables and must never depend on values from `.env.example`. Prefer Vercel's trusted client-IP header, validate the value, and store only a keyed hash. Re-verify the trust chain if a proxy is added in front of Vercel. See **Decision: Vercel production environment and IP trust** below.
8. **Refactor scope — decided**: extract the shared auth pieces into `components/auth/`. Move the common auth shell, font setup, button styles, and layout constants needed by Login, Signup, and Forgot Password. Keep route-specific fields, validation, actions, and screen-state logic local to each route. See **Decision: shared auth pieces** below.
9. **Resend semantics — decided**: "Resend Link" re-runs the same password-reset action and is subject to both IP and email limits. Use a 60-second client cooldown, but treat the server's retry-after value as authoritative after reload. Email-level limits remain on **Check Your Email**; only IP-level limits show **Too Many Reset Requests**. See **Decision: resend semantics and cooldown** below.
10. **Recovery session vs session-timebox logic — boundary decided, post-success behavior pending Story 0.7**: treat a recovery session as a special-purpose session. It must not receive session extensions, show the stay-logged-in notice, or grant protected-app access before the password is updated. Story 0.7 must decide whether to clear the recovery session and require a normal login after success, or explicitly accept auto-login as a product behavior. See **Decision: recovery-session boundary** below.
11. **Verification gaps — verification plan decided**: keep the product policies already recorded, but verify GoTrue behavior with real local and CI integration tests before implementation review. The verification must cover unknown-email responses, `max_frequency`, `email_sent`, provider 429 shapes, captured recovery emails, and `token_hash` verification. Record CI run IDs and Playwright artifacts as evidence. See **Decision: GoTrue verification evidence** below.
12. **Timing equalization**: the mockup requires the loading-to-screen transition to have the same minimum duration for registered, unregistered, and provider-error cases, but the duration and enforcement layer are not defined. The plan must choose a named minimum response duration, preferably in the use case/action layer, and add tests that cover the timing contract without asserting fragile exact wall-clock equality.
13. **Recovery-session enforcement mechanism**: the policy says a recovery session must not access protected pages or enter session-extension logic before the password update, but the repository has no recovery-session marker or classifier. Story 0.7 must define how the recovery state is identified and enforced before relying on `requireSession()` or normal session claims.
14. **Email-key normalization**: define the normalization used for the per-email limiter before hashing the key. The recommended input is trimmed and lowercased email text, with no raw email stored or logged; the plan should confirm whether any additional Unicode normalization is required.
15. **Rate-limit data lifecycle**: the Postgres limiter decision still needs a concrete table/index contract, atomic update strategy, expired-row cleanup, retention period, and migration synchronization between `supabase/` and `supabase-test/`.
16. **Change-document consistency**: `change.md` still says `Open Questions: None`, while this research contains Story 0.7 integration dependencies and pending verification work. Before implementation, either update `change.md` or explicitly state that the research file is the source of truth for these decisions and follow-ups.

## Recheck Findings

The research is complete enough to start planning, but the following details must be closed in the plan before implementation:

- **Exact confirmation endpoint**: prefer `/api/auth/confirm` to reuse the existing public `/api/auth` prefix. The recovery template should use a server-side URL containing `token_hash={{ .TokenHash }}` and `type=recovery`; Supabase also provides `{{ .RedirectTo }}` for the redirect contract. See the [Supabase email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates).
- **Minimum response duration**: define one named constant and test the minimum-duration behavior rather than exact timing equality.
- **Recovery-session classification**: define the mechanism in Story 0.7 before allowing the session to reach protected routes or session-extension code.
- **Email limiter key**: normalize, hash, and retain only the minimum data needed for rate limiting.
- **Postgres limiter operations**: document atomicity, indexes, cleanup, retention, and both local migration paths.
- **Provider configuration**: document the local template file, hosted Dashboard template, exact redirect allow-list entries, and the CI evidence required to prove the two environments behave consistently.

## Decisions

### Decision: Rate-limit policy

**Status**: accepted for planning

**Decision**:

Use two rate-limit layers: an IP-based limit to control abuse and provide user-visible feedback, and a silent email-based limit to prevent inbox spam without weakening the anti-enumeration invariant.

**Implementation**:

- **Per IP**: 5 password-reset requests per hour using a token bucket with capacity 5 and a refill rate of 1 request every 12 minutes.
- **Per email**: one request per 60 seconds. The implementation plan must explicitly choose whether to add a five-request-per-hour ceiling to the same keyed limiter; any email-level rejection must remain silent. The recommended default is to add the ceiling for inbox-abuse protection.
- **Resend**: the client-side resend cooldown is 60 seconds.
- **Supabase**: keep Supabase's own limits as a provider-level backstop. Do not use them to drive the countdown because the project-wide email quota and provider errors do not provide a reliable user-specific retry time.

**User-visible outcomes**:

- An IP-level limit returns `rate_limited` with a retry-after value and renders **Too Many Reset Requests**.
- An email-level limit returns the same neutral `sent`/**Check Your Email** outcome as a successful request, without sending another message.
- Registered emails, unregistered emails, provider failures, and email-level rate limits must not produce distinguishable client-visible results.

**Rationale**:

- The 5/hour/IP threshold matches the mockup's example and is appropriate as an MVP default for this low-volume application.
- A refill-based token bucket avoids the sharp reset behavior of a fixed hourly window while still enforcing the same sustained rate.
- A per-email cooldown limits inbox abuse, while hiding that condition preserves the anti-enumeration invariant.
- A `RateLimiter` port keeps the policy independent from the storage implementation (in-memory for tests/dev, with a durable production store such as Postgres RPC or Redis).

**Operational caveat**: per-IP limiting can affect users sharing a public IP, such as office or university networks. The implementation must also validate the deployment's handling of `x-forwarded-for` before trusting it for the key. CAPTCHA or policy tuning can be added later if production traffic shows false positives or abuse.

### Decision: limit-state visibility

**Status**: accepted for planning

**Decision**:

Show **Too Many Reset Requests** only when the IP-level limit is exceeded. Email-level limits, unknown emails, and provider errors must show the existing **Check Your Email** state.

**Implementation**:

- Exceeding the application-level **IP** limit returns `rate_limited` with a retry-after value and renders **Too Many Reset Requests**.
- Exceeding the **email** limit is silent: skip another provider call and return the same neutral `sent`/**Check Your Email** outcome used for successful, unknown-email, and provider-error cases.
- The client-visible state must never distinguish whether a particular email address exists.

**Outcome mapping**:

```text
IP limit exceeded
→ Too Many Reset Requests + countdown

Email limit exceeded
→ Check Your Email (existing state)

Unknown email / provider error
→ Check Your Email (existing state)
```

**Rationale**:

- An IP-level limit does not reveal the existence of an account, so the waiting state is acceptable and gives the user actionable feedback.
- An email-level limit could reveal that the address is associated with an account if it produced a distinct error or screen.
- The decision preserves the mockup's `00.3c` screen without weakening the anti-enumeration invariant.

### Decision: limiter store

**Status**: accepted for planning

**Decision**:

Use Supabase Postgres as the durable production rate-limit store, accessed through a narrow atomic RPC. Keep the application dependent on the `RateLimiter` interface rather than on the storage implementation.

**Implementation**:

- Add a private rate-limit table and an atomic Postgres function for IP and email keys.
- Keep a matching migration or configuration copy in `supabase-test/` where the local E2E stack requires it.
- Use an in-memory `RateLimiter` implementation for unit tests and isolated development only.
- Secure the RPC with a private table, a pinned `search_path`, schema-qualified names, and restricted execute permissions.
- If the limiter itself is unavailable, log the failure safely and return the neutral **Check Your Email** result rather than exposing account state.

**Rationale**:

- Supabase Postgres is already part of the application stack, so this avoids adding another hosted service, dependency, and set of production environment variables.
- A database-backed limiter is shared across Vercel function instances and survives cold starts, unlike an in-memory map.
- The expected MVP traffic is low enough that the additional database operation is acceptable.
- The `RateLimiter` port preserves the option to move to Upstash Redis later if traffic, latency, or operational requirements justify it.

### Decision: reset-link flow and story boundary

**Status**: accepted for planning

**Decision**:

Use Supabase's `token_hash` recovery flow instead of the PKCE code flow. Keep the work split into two stories: Story 0.6 requests and sends the reset email, while Story 0.7 verifies the link and lets the user set a new password.

**Implementation**:

- Story 0.6 calls `resetPasswordForEmail` with the agreed reset destination and defines the recovery-email contract.
- The recovery email template must create a link containing the recovery `token_hash` and `type=recovery` for the confirmation handler.
- Story 0.7 adds the chosen confirmation handler (recommended route: `/api/auth/confirm`), calls `verifyOtp({ type: "recovery", token_hash })`, and redirects to `/reset-password`.
- Story 0.7 owns the new-password form, password validation, `updateUser({ password })`, and invalid, expired, or already-used link states.
- The confirmation route must be public, must not log tokens, and must validate any redirect destination.

**Rationale**:

- `token_hash` allows the user to open the reset email on a different device or browser, avoiding the PKCE verifier-cookie limitation.
- Keeping the stories separate preserves the existing product boundary: requesting an email is one user action, while consuming the link and changing the password is a separate action after an email round-trip.
- Story 0.6 can establish the email and redirect contract without absorbing the complete password-change flow.
- The separation makes Story 0.7 independently testable for token verification, password update, and recovery-link failure states.

### Decision: provider rate-limit neutrality and E2E verification

**Status**: policy accepted; provider behavior pending CI verification

**Decision**:

Treat provider-level rate limits as neutral. A provider `429`, including `over_email_send_rate_limit` or `over_request_rate_limit`, must not produce a distinct client-visible state because the response may differ between registered and unregistered emails. Only the application-level IP limiter may produce **Too Many Reset Requests**.

**Implementation**:

- Add E2E coverage that requests password resets for both a known test email and a unique unknown email.
- Repeat requests for each email and compare HTTP outcomes, provider error codes captured only in safe server logs, response shape, visible screen, and relevant timing behavior.
- Assert that provider-level throttling maps to **Check Your Email** for both email categories.
- Keep the existing application-level IP-limit E2E separate and assert that it maps to **Too Many Reset Requests** with a countdown.
- Run the real-provider E2E verification in GitHub Actions/CI. The current macOS 13 environment does not support the Chromium-based Playwright run, so local execution cannot be treated as authoritative evidence.
- Record the CI workflow run ID and environment as verification evidence in the implementation or review notes.

**Rationale**:

- Supabase documents that unknown email addresses return without an error and do not receive an email, but it does not fully specify whether user-level throttling treats unknown and registered addresses identically.
- Surfacing a provider-level 429 could reveal that an email address exists if the provider applies the limit only to known users.
- A neutral mapping preserves the anti-enumeration invariant regardless of the provider's internal behavior.
- CI is required for browser-level evidence because the local macOS 13 environment cannot run the project's Chromium-based Playwright tests reliably.

### Decision: local E2E email capture and CI verification

**Status**: accepted for planning

**Decision**:

Use the local Supabase email-capture service for E2E recovery-link tests. Add a test helper that can read captured messages and extract the recovery URL. Keep the higher email quota limited to local/test configuration. GitHub Actions/CI on Ubuntu is the authoritative browser E2E environment.

**Implementation**:

- Add an `e2e/helpers/auth-email.ts` helper that finds messages by recipient, polls until delivery, reads the message body, extracts the recovery URL, and cleans up test messages.
- Resolve the actual local capture service exposed by the pinned Supabase CLI version; the repository currently uses the `[inbucket]` configuration while current Supabase documentation refers to Mailpit.
- Raise `auth.rate_limit.email_sent` only in local/test configuration to prevent unrelated happy-path tests from exhausting the default two-email quota. Do not use this setting for production.
- Keep provider-level `429` verification separate from normal happy-path email tests so the suite does not depend on a low shared quota.
- Add E2E coverage for:
  - a registered email reaching **Check Your Email** and producing a captured recovery email;
  - an unknown email producing the same visible state and no distinguishable client response;
  - repeated provider responses mapping to **Check Your Email**;
  - application IP-limit exhaustion producing **Too Many Reset Requests** with a countdown;
  - extracting a `token_hash` link and opening it in a new browser context before Story 0.7's password-update flow;
  - captured-email cleanup and timeout behavior.
- Run the browser suite in GitHub Actions on Ubuntu with the existing Playwright Chromium installation. Treat the CI workflow run ID and artifact report as the authoritative verification evidence.

**Rationale**:

- Local email capture allows reset-link tests without sending real email or depending on a hosted provider.
- A polling helper makes delivery timing explicit and keeps email parsing reusable across recovery tests.
- A test-only quota avoids accidental coupling between the provider's project-wide email quota and the application's own rate-limit policy.
- A fresh browser context proves that the selected `token_hash` flow does not depend on the request browser's PKCE cookie.
- The current macOS 13 development environment cannot run the project's Chromium-based Playwright tests reliably, so CI is required for trustworthy browser-level evidence.

### Decision: Vercel production environment and IP trust

**Status**: deployment clarified; implementation policy accepted for planning

**Decision**:

Treat Vercel Production, deployed from the `main` branch, as the production target. Treat `.env.example` only as documentation of required variable names. Production configuration must come from Vercel Production Environment Variables and must not read, load, or depend on `.env.example` values.

**Implementation**:

- Use the Vercel Production values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, and any future rate-limiter secrets.
- Keep `.env.example` free of real production credentials; document names and safe placeholder values only.
- Do not add or depend on a committed `.env.production` file for the live site. Vercel Production Environment Variables are the production source of truth.
- Prefer `x-vercel-forwarded-for` for the Vercel IP key, validate the value, and keep the extraction logic behind a testable adapter in `lib/auth/`.
- Store a keyed hash of the validated IP rather than the raw IP address.
- If a proxy is added in front of Vercel later, re-verify the forwarded-IP trust chain before changing the limiter policy.

**Rationale**:

- Vercel Production Environment Variables are the runtime/build configuration for the live deployment; `.env.example` is not an environment source.
- Keeping the template separate prevents accidental credential leakage and avoids confusing local defaults with production settings.
- The rate limiter must use the actual end-user IP only when the deployment platform guarantees that the selected header cannot be spoofed.

### Decision: shared auth pieces

**Status**: accepted for planning

**Decision**:

Extract the shared authentication UI primitives into `components/auth/` and reuse them from Login, Signup, and Forgot Password. Keep route-specific form behavior and state management local to each route.

**Implementation**:

- Move or promote the shared auth page shell, font setup, button styles, and common layout constants into `components/auth/`.
- Reuse the existing `AuthLogo` and shared field/link styles where applicable.
- Update Login and Signup imports to use the shared primitives.
- Build Forgot Password on the shared primitives rather than copying a third page shell or style object.
- Keep Login-specific fields, Signup-specific password validation, Forgot Password-specific status screens, Server Actions, and state transitions local to their routes.
- Add or update focused component tests for the affected imports and shared rendering contract.

**Rationale**:

- Prevents a third copy of the auth shell, font setup, and button styles.
- Keeps the refactor focused on reusable presentation primitives instead of expanding into a full form or design-system rewrite.
- Makes future auth screens visually consistent and allows shared styling changes from one location.
- Preserves route-specific behavior and reduces the risk of coupling unrelated auth flows.

### Decision: resend semantics and cooldown

**Status**: accepted for planning

**Decision**:

"Resend Link" re-runs the same password-reset action. It does not bypass the application rate limiter or create a separate unrestricted resend path.

**Implementation**:

- Apply both the IP-level and email-level limits to resend requests.
- Use a 60-second client-side resend cooldown.
- Treat the server-provided retry-after value as authoritative after reload or a new request.
- Keep email-level limit responses on **Check Your Email**.
- Show **Too Many Reset Requests** only when the application-level IP limit is exceeded.
- Do not put the submitted email address in the URL. Keep the flow state in client state during the current navigation and let the server limiter remain the source of truth.

**Rationale**:

- Resend is still a password-reset request and must not bypass abuse controls.
- The client cooldown improves UX but is not a security boundary because users can reload or call the action directly.
- A server-authoritative retry-after value keeps the countdown correct after reloads and across multiple application instances.
- Keeping email-level limits neutral preserves the anti-enumeration invariant.

### Decision: recovery-session boundary

**Status**: boundary accepted; post-success session disposition deferred to Story 0.7

**Decision**:

Treat the session created by recovery-link verification as a special-purpose recovery session, not as a normal login session. It exists to authorize the password update and must not silently enter the application's normal session-extension lifecycle.

**Implementation**:

- Keep `/auth/confirm` and `/reset-password` public so the recovery flow can be entered without a normal authenticated session.
- Story 0.7 must distinguish the recovery flow from a normal login before applying `requireSession()` or protected-page access rules.
- Do not create or apply `session_extensions` for a recovery session.
- Do not show the stay-logged-in notice during the recovery flow.
- Do not allow protected application access before the password update succeeds.
- Story 0.7 must decide and test the post-success behavior. The recommended default is to clear the recovery session and require a normal login; keeping the session is allowed only as an explicit product decision.
- Add E2E coverage for successful, expired, and already-used recovery links, protected-page access before update, session-extension exclusion, and the chosen post-success behavior.

**Rationale**:

- A recovery session has a narrower purpose than a normal login session and should not automatically inherit the full application session lifecycle.
- Treating it as a normal session could let a reset link grant dashboard access before the password is changed or create an unintended 30-day session.
- Excluding recovery sessions from extension and notice logic reduces session-state ambiguity and keeps the security boundary explicit.
- Deferring the final post-success choice to Story 0.7 keeps Story 0.6 focused on requesting and sending the reset email while preserving a clear integration contract.

### Decision: GoTrue verification evidence

**Status**: verification plan accepted; provider behavior pending execution

**Decision**:

Keep the product policies already decided, but do not treat undocumented or locally unverified GoTrue behavior as implementation evidence. Verify the provider behavior with the real local Supabase stack and the authoritative GitHub Actions/CI E2E environment before implementation review.

**Implementation**:

- Verify that a registered email returns the expected success response and produces a captured recovery email.
- Verify that an unknown email returns the same client-visible result without producing a recovery email.
- Verify `auth.email.max_frequency` behavior for both registered and unknown emails.
- Verify whether local email capture is subject to `auth.rate_limit.email_sent` and document the effective test configuration.
- Capture and classify provider `429` responses, including `over_email_send_rate_limit` and `over_request_rate_limit`, without exposing their details to the client.
- Verify the recovery email template and `token_hash` URL contract in the Story 0.7 integration tests.
- Run browser-level E2E in GitHub Actions/CI on Ubuntu and treat the workflow run ID and Playwright report as authoritative evidence because the current macOS 13 environment cannot run the Chromium suite reliably.
- Record any remaining differences between local, CI, and hosted Supabase configuration in the implementation or review notes.

**Rationale**:

- The product security policy must not depend on undocumented provider behavior.
- Real integration tests can reveal differences between registered and unknown email handling, which is essential for anti-enumeration.
- Provider error shape and local email-service behavior affect adapters and test reliability even when all provider errors map to the neutral **Check Your Email** state.
- CI evidence is required for browser-level claims that cannot be reproduced reliably on the current macOS 13 development environment.
