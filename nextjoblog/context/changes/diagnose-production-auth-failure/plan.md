# Diagnose Production Signup and Login Failure Implementation Plan

## Overview

Make production signup and login failures diagnosable and safe across Vercel and hosted Supabase environments. The plan addresses the two evidence-backed causes in the research: missing or malformed public Supabase configuration, and hosted Auth email-confirmation behavior that the current Server Actions do not distinguish from an authenticated signup.

The implementation keeps the existing local no-confirmation flow working, while making the application behave correctly when hosted confirmation is enabled and producing useful, redacted diagnostics when deployment configuration is wrong.

## Current State Analysis

The server Supabase client reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` directly with non-null assertions in `lib/supabase/server.ts`. The same URL is parsed at module load in `proxy.ts`, so a missing or malformed production URL can fail before `signup` or `login` reaches its own error handling.

`app/actions/auth.ts` already validates basic input, maps duplicate signup and invalid-credential errors, logs provider failures, and redirects outside the `try/catch`. Signup checks `data.user` but not `data.session`; hosted email confirmation can therefore redirect an unauthenticated user to `/dashboard`. Login does not map `email_not_confirmed`, so the user sees the generic login error.

The signup and login forms render only the current discriminated states. There are component tests, but no direct Server Action tests for the auth actions. The E2E suite assumes local Supabase has confirmations disabled and expects successful signup to redirect immediately.

The repository contains local Supabase Auth settings in `supabase/config.toml`, but no checked-in production environment contract or deployment runbook. The local configuration does not configure the hosted Supabase project.

### Key Discoveries:

- `lib/supabase/server.ts:5-27` constructs the server client from two required public environment variables without runtime validation.
- `proxy.ts:10-13` parses the Supabase URL at module load and also constructs a Supabase client, making it part of the production configuration failure surface.
- `app/actions/auth.ts:50-88` redirects after any successful `signUp()` response containing a user, even if `data.session` is absent.
- `app/actions/auth.ts:104-134` maps only `invalid_credentials`; hosted `email_not_confirmed` is currently generic.
- `app/signup/SignupForm.tsx` and `app/login/LoginForm.tsx` are the established Server Action state-rendering pattern.
- `__tests__/signup/SignupForm.test.tsx` and `__tests__/login/LoginForm.test.tsx` provide the existing UI test conventions; no auth action test file exists.
- `supabase/config.toml:154-184` is local-only configuration, so changing it cannot repair a hosted project's Auth settings.
- `e2e/signup.spec.ts` and `e2e/login.spec.ts` depend on confirmations being disabled in the test Supabase instance.

## Desired End State

Production auth requests use a validated Supabase URL and public key, and invalid configuration produces a clear server-side diagnostic plus a safe user-facing failure state rather than an opaque SDK or URL-parsing exception.

Signup redirects to `/dashboard` only when Supabase returns both a user and an authenticated session. When confirmation is required, the user remains on the signup flow with clear instructions to verify their email. Login explicitly recognizes an unconfirmed account and provides a recovery-oriented message, while preserving generic messaging for unclassified failures.

The repository documents the required Vercel Production variables, hosted Supabase Auth settings, redaction rules, and a post-deploy smoke-test sequence. Automated tests cover the new action contracts and UI states without depending on production services.

## What We're NOT Doing

- We are not automating changes to the Vercel or hosted Supabase dashboards.
- We are not introducing a service-role key into the application runtime or client bundle.
- We are not disabling email confirmation in hosted production as a code-side workaround.
- We are not adding password reset, email resend, OAuth, or account recovery flows beyond the messages and links needed for this failure diagnosis.
- We are not changing database schema, RLS policies, session duration, or dashboard route protection.
- We are not adding an external monitoring vendor or production health-check service.
- We are not changing the existing local E2E assumption that confirmations are disabled.

## Implementation Approach

Create one small runtime configuration boundary used by the server client and proxy. It validates that the public Supabase URL is a valid HTTP(S) URL and that the public key is present, while exposing only safe diagnostic metadata. Auth Server Actions catch configuration failures and return their existing safe failure shape; the proxy no longer parses an unchecked environment value at module load and handles configuration failure without leaking secrets.

Extend the auth state contracts with explicit confirmation-required states. Signup branches on `data.session`, login maps the Supabase confirmation error code, and the existing client forms render the new states. Add focused Server Action tests by mocking the established server-client seam, then extend component tests for the new messages. Keep local E2E behavior unchanged and document a separate production smoke test for both confirmation modes.

## Critical Implementation Details

### Timing & lifecycle

The shared configuration helper must be called at request time rather than parsing `process.env` or constructing a URL-derived cookie name at module load. This keeps the proxy importable in tests and lets the auth actions convert configuration failures into their safe return states.

### Debug & observability

Auth diagnostics may include event name, stable provider error code/status, deployment environment, and whether signup returned a user/session. They must never include passwords, access tokens, cookies, Supabase keys, raw emails, or full provider error payloads. Tests should assert that representative sensitive values are absent from logged arguments.

### Code Quality Standards

- **Test coverage**: `vitest.config.mts` already enforces an 80% threshold (lines, statements, functions, branches) repo-wide; every new file this plan adds (`lib/supabase/config.ts`, the new confirmation-state branches in `app/actions/auth.ts`, the new UI states) must be covered by the new/extended tests in Phase 1 item 4, Phase 2 items 5–6, so `npm run test:run` continues to pass with thresholds intact rather than needing an exclusion added.
- **SOLID**: `lib/supabase/config.ts` is a single-responsibility module (config resolution only, no client construction); `createServerSupabaseClient()` and `proxy`'s Supabase client stay open for extension (new config fields) without modification to their call sites; auth Server Actions depend on the config getter's return type/error shape, not on `process.env` directly, keeping the dependency direction injectable for tests.
- **Clean, readable code**: no magic strings for state discriminants — reuse and extend the existing discriminated-union pattern (`{ error: "..." }` / new `{ status: "confirmation_required" }`-style states) already used in `SignupFormState`/`LoginFormState`; error/event names are named constants, not inline literals duplicated across `auth.ts` and its tests.
- **Testability**: the config getter takes no hidden dependencies beyond `process.env` and returns a plain value or throws a typed error, so it mocks cleanly with the repo's existing `vi.mock`/hoisted-mock pattern (`__tests__/actions/session.test.ts`) without needing to stub globals.
- **Accessibility**: the new confirmation-required and configuration-failure alerts in `SignupAlerts.tsx`/`LoginAlert.tsx` follow the existing `role="alert"` pattern, remain reachable via keyboard (no new interactive elements introduced without focus handling), and communicate state through text content, not color alone.
- **Project structure**: no new top-level conventions are introduced; new files land in the existing App Router structure (`app/actions/`, `app/signup/`, `app/login/`, `lib/supabase/`, `__tests__/`, `e2e/`, `docs/`) per [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure) and this repo's established layout — no ad hoc top-level folders.

## Phase 1: Establish the Production Configuration Boundary

### Overview

Make the Supabase runtime configuration explicit, validated, and safe to use from both Server Actions and the request proxy.

### Changes Required:

#### 1. Shared Supabase runtime configuration

**File**: `lib/supabase/config.ts` (new)

**Intent**: Add the single source of truth for reading and validating the two public Supabase runtime variables. Keep the validation focused on deployment correctness: URL syntax/protocol and non-empty public key, without validating or exposing secrets.

**Contract**: Export a typed configuration getter and a typed/config-identifiable error or equivalent stable failure signal. The getter must return the validated URL and anon/publishable key; diagnostic metadata must be safe to log and must not contain the key value. The getter must be a pure, side-effect-free function that re-reads and re-validates `process.env` on every call — no module-level caching/memoization of the validated config or of prior failures. This module is imported by both Server Actions and `proxy.ts`; Next's Proxy docs (`node_modules/next/dist/docs/.../file-conventions/proxy.md`) warn against relying on shared modules or globals in Proxy because an optimized deployment may run Proxy on a separate tier from render-time code, so any mutable module-level state here would not reliably be shared across the two.

#### 2. Server client construction

**File**: `lib/supabase/server.ts`

**Intent**: Replace direct non-null environment access with the shared configuration boundary so every Server Action receives the same validation behavior.

**Contract**: `createServerSupabaseClient()` continues returning the existing `SupabaseClient` shape to callers. Invalid configuration throws the shared configuration failure before `createServerClient` is invoked, allowing callers to handle it deterministically.

#### 3. Proxy configuration handling

**File**: `proxy.ts`

**Intent**: Remove module-load URL parsing based on an unchecked environment value and use the shared configuration boundary at request time. Preserve the existing cookie refresh, session-expiry cleanup, and header-forwarding behavior when configuration is valid.

**Contract**: The proxy must remain importable without valid test/development environment variables. On invalid configuration it must log only safe diagnostic metadata and return a controlled response that does not expose provider credentials or a stack trace to the browser. The `authCookieStorageKey` derivation (`sb-<hostname-first-label>-auth-token`) must move to request time alongside the config lookup but must produce byte-for-byte the same key as today's module-load computation for any given valid URL — `e2e/session-expiry.spec.ts` independently re-implements this exact formula and will silently diverge from production behavior if the derivation changes.

#### 4. Configuration-boundary tests

**File**: `__tests__/lib/supabase-config.test.ts` (new)

**Intent**: Lock down valid URL/key handling, missing-variable failures, malformed/non-HTTP URL failures, and redacted diagnostic metadata.

**Contract**: Tests must restore environment state between cases and prove that the failure signal is stable enough for Server Actions and proxy handling without asserting implementation-private wording.

### Success Criteria:

#### Automated Verification:

- `npm run test:run -- __tests__/lib/supabase-config.test.ts` passes.
- Existing auth/session unit tests pass with the shared configuration seam mocked or configured.
- A test asserts the request-time `authCookieStorageKey` derivation in `proxy.ts` is unchanged for a representative URL, matching the formula duplicated in `e2e/session-expiry.spec.ts`.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual Verification:

- With valid local variables, signup/login and existing session-refresh behavior still start normally.
- With the Supabase URL removed or malformed in a controlled local run, the request produces a controlled failure and the server log contains diagnostic context without the key or cookie contents.

**Implementation Note**: After automated verification passes, pause for manual confirmation of the invalid-configuration behavior before proceeding to Phase 2.

## Phase 2: Harden Auth Actions and User-Facing States

### Overview

Make signup and login distinguish authenticated success, email confirmation requirements, invalid credentials, provider/configuration failures, and unknown failures without exposing sensitive provider details.

### Changes Required:

#### 1. Server Action state contracts and branching

**File**: `app/actions/auth.ts`

**Intent**: Extend the existing discriminated unions with explicit confirmation/configuration states, branch signup on the presence of `data.session`, and map the hosted confirmation error returned by password login. Preserve duplicate-email, weak-password, invalid-credentials, generic messaging, and redirect-outside-`try/catch` behavior.

**Contract**: A signup response with a user but no session must return a confirmation-required state and must not call `redirect`. A signup response with both user and session continues to redirect to `/dashboard`. Login must return a confirmation-required state for the provider's unconfirmed-email condition. Configuration failures must return a safe configuration-related state while logs retain only the redacted diagnostic fields defined in Phase 1.

#### 2. Redacted auth diagnostics

**File**: `app/actions/auth.ts` and, if needed, `lib/supabase/config.ts`

**Intent**: Replace undifferentiated provider logging with stable event labels and safe metadata for signup and login failures. Preserve enough information to distinguish configuration failure, confirmation-required, provider rejection, and unexpected exceptions in Vercel logs.

**Contract**: Log event name and stable error code/status where available; never log raw form data, email addresses, passwords, tokens, cookies, keys, or full error objects whose serialization could include request details.

#### 3. Signup confirmation UI

**File**: `app/signup/SignupForm.tsx`, `app/signup/SignupAlerts.tsx`

**Intent**: Render a confirmation-required alert using the existing visual and link patterns, keeping the fields available for retry and providing a clear path to login after verification.

**Contract**: The new state renders an accessible `role="alert"` with stable test identification and copy that says the account was created but email verification is required before login. Existing duplicate and generic alert behavior remains unchanged.

#### 4. Login confirmation UI

**File**: `app/login/LoginForm.tsx`, `app/login/LoginAlert.tsx`

**Intent**: Render a distinct confirmation-required login message while preserving the current invalid-credentials treatment and generic fallback.

**Contract**: The new state is represented by the existing alert component or a narrowly scoped variant, remains accessible, and does not reveal whether arbitrary email addresses are registered beyond the action's deliberate state.

#### 5. Server Action tests

**File**: `__tests__/actions/auth.test.ts` (new)

**Intent**: Test the action contracts directly using the repository's established `vi.mock`/hoisted-mock pattern for `createServerSupabaseClient`, `redirect`, and Supabase auth responses.

**Contract**: Cover successful signup with session, signup with user/no session, duplicate signup, weak password, invalid email, successful login, invalid credentials, unconfirmed email, invalid configuration, unexpected provider failure, and the invariant that redirect is not swallowed by error handling.

#### 6. Form component tests

**File**: `__tests__/signup/SignupForm.test.tsx`, `__tests__/login/LoginForm.test.tsx`

**Intent**: Extend the existing state-rendering tests for confirmation-required and configuration-safe messages, retaining current regression coverage for duplicate, invalid-credentials, generic, validation, and pending states.

**Contract**: Assert accessible alert text and stable links where applicable; do not couple tests to provider-native error text.

### Success Criteria:

#### Automated Verification:

- `npm run test:run -- __tests__/actions/auth.test.ts __tests__/signup/SignupForm.test.tsx __tests__/login/LoginForm.test.tsx` passes.
- `npm run test:run` passes with coverage thresholds intact.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual Verification:

- With hosted confirmation behavior simulated, signup remains on the signup page and shows verification guidance instead of redirecting to `/dashboard`.
- A confirmed account can still log in and reach `/dashboard`.
- Invalid credentials remain generic, while an unconfirmed account receives the specific recovery guidance.
- No password, token, cookie, email address, or Supabase key appears in the rendered UI or server diagnostic output.

**Implementation Note**: After automated verification passes, pause for manual confirmation of the confirmation-required and confirmed-account flows before proceeding to Phase 3.

## Phase 3: Regression Coverage and Production Runbook

### Overview

Preserve deterministic local E2E behavior, document the external production contract, and provide a repeatable post-deploy diagnosis and rollback sequence.

### Changes Required:

#### 1. Production environment contract

**File**: `.env.example` (new)

**Intent**: Declare the required public Supabase variables and distinguish them from test-only/service-role variables without committing values.

**Contract**: Include variable names and short descriptions only; never include a real URL, anon key, service-role key, password, or token.

#### 2. Deployment and diagnosis runbook

**File**: `docs/production-auth.md` (new)

**Intent**: Document the Vercel Production variable checklist, hosted Supabase Auth settings, local-versus-hosted configuration boundary, log signals, smoke tests, and rollback guidance.

**Contract**: The runbook must explicitly require the hosted Supabase project URL and public anon/publishable key in Vercel Production, explain that `supabase/config.toml` is local-only, state the selected confirmation-compatible behavior, and define a safe order: verify configuration, deploy, smoke-test, then revert code or settings if auth remains unavailable.

#### 3. Local E2E regression coverage

**File**: `e2e/signup.spec.ts`, `e2e/login.spec.ts`, `e2e/session-expiry.spec.ts`

**Intent**: Keep the existing local confirmation-disabled happy paths and add assertions only where they improve the production diagnosis contract without creating production data dependencies. `e2e/session-expiry.spec.ts` is in scope because it duplicates the `authCookieStorageKey` derivation that Phase 1 moves to request time; it needs no behavior change but must be run and confirmed unaffected.

**Contract**: Local E2E continues to verify successful signup/login, duplicate and invalid-credential behavior, and profile/session invariants. Confirmation-required behavior is covered deterministically by Server Action/component tests rather than by toggling the shared local Supabase instance during the suite. `e2e/session-expiry.spec.ts`'s cookie-decoding assertions must continue to pass unchanged, confirming the Phase 1 cookie-key derivation stayed identical under real request/response handling.

#### 4. Production smoke-test checklist

**File**: `docs/production-auth.md`

**Intent**: Define manual checks against the deployed Vercel origin using a disposable test account and an existing confirmed account, plus the exact Vercel log and Supabase Auth checks to perform when a case fails.

**Contract**: The checklist must cover: fresh signup, confirmation-required signup if enabled, confirmed-user login, wrong password, duplicate email, missing/malformed variable diagnosis in a non-production environment, production URL/site URL alignment, and no secret leakage in logs.

### Success Criteria:

#### Automated Verification:

- `npm run test:run` passes.
- `npm run test:e2e` passes against the configured local Supabase/test environment.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `.env.example` and the canonical production-auth runbook exist and contain no secret values.

#### Manual Verification:

- Vercel Production contains the hosted Supabase URL and public key under the correct production environment scope.
- Hosted Supabase signup and email-confirmation settings match the intended confirmation-compatible behavior.
- The deployed app passes fresh signup, confirmed login, invalid-credential, duplicate-email, and confirmation-required checks as applicable.
- If a check fails, Vercel logs identify the category without exposing secrets, and the documented rollback sequence is actionable.

## Testing Strategy

### Unit Tests:

- Validate the shared configuration boundary for valid, missing, empty, malformed, and unsupported-protocol values.
- Test signup's user/session matrix and login's provider-error mapping.
- Test safe handling of configuration exceptions and unexpected provider failures.
- Test redacted diagnostic arguments.
- Every new/changed source file stays within `vitest.config.mts`'s existing 80% lines/statements/functions/branches thresholds (repo-wide, not a per-file exclusion); Phase 2 and Phase 3 success criteria already run `npm run test:run` with thresholds intact to enforce this.

### Integration Tests:

- Preserve the existing local Playwright signup/login flows with confirmations disabled.
- Verify that the existing profile creation and session/RLS assertions still pass after configuration-client changes.
- Do not make automated tests depend on the live Vercel deployment or hosted Supabase dashboard state.

### Manual Testing Steps:

1. Confirm Vercel Production variables point to the hosted Supabase project and are scoped to the deployed environment.
2. Confirm the hosted project's signup, email confirmation, Site URL, and redirect URL settings.
3. Sign up with a disposable email and verify the expected immediate-session or confirmation-required behavior.
4. Log in with a confirmed account, then test a wrong password and an unconfirmed account.
5. Inspect Vercel logs for category-specific diagnostics and verify no secrets or raw credentials are present.
6. If any production check fails, follow the runbook's configuration correction or rollback path and repeat the smoke test.

## Performance Considerations

The configuration validation is request-boundary work for auth/proxy requests and should be constant-time relative to the environment values. Avoid network calls, Supabase Admin APIs, or per-request external health checks. Logging should remain limited to failure paths.

## Migration Notes

No database migration is required. Existing local `.env.local` values remain uncommitted and continue to drive local development. The operator must separately configure Vercel Production and the hosted Supabase Auth project; local `supabase/config.toml` does not propagate those settings. If the deployment currently has invalid variables, correct them before or alongside the code deployment, then run the smoke-test checklist.

## References

- Related research: `context/changes/diagnose-production-auth-failure/research.md`
- Server auth actions: `app/actions/auth.ts:1-136`
- Server Supabase client: `lib/supabase/server.ts:1-27`
- Proxy configuration and session refresh: `proxy.ts:1-57`
- Local Auth configuration: `supabase/config.toml:154-184`
- Existing signup UI tests: `__tests__/signup/SignupForm.test.tsx`
- Existing login UI tests: `__tests__/login/LoginForm.test.tsx`
- Existing local E2E flows: `e2e/signup.spec.ts`, `e2e/login.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Establish the Production Configuration Boundary

#### Automated

- [x] 1.1 Configuration-boundary tests pass — 57def74
- [x] 1.2 Existing auth/session unit tests pass with the shared configuration seam — 57def74
- [x] 1.3 Type checking passes — 57def74
- [x] 1.4 Linting passes — 57def74

#### Manual

- [x] 1.5 Valid local configuration still starts auth/session behavior — 57def74
- [x] 1.6 Invalid configuration produces a controlled response and redacted diagnostic — 57def74

### Phase 2: Harden Auth Actions and User-Facing States

#### Automated

- [x] 2.1 Auth Server Action tests pass — 3a70684
- [x] 2.2 Signup and login component tests pass for new and existing states — 3a70684
- [x] 2.3 Full unit suite passes with coverage thresholds — 3a70684
- [x] 2.4 Type checking passes — 3a70684
- [x] 2.5 Linting passes — 3a70684

#### Manual

- [x] 2.6 Confirmation-required signup stays on signup with verification guidance — 3a70684
- [x] 2.7 Confirmed login, invalid credentials, and unconfirmed login show the intended outcomes — 3a70684
- [x] 2.8 Auth UI and diagnostics contain no sensitive values — 3a70684

### Phase 3: Regression Coverage and Production Runbook

#### Automated

- [ ] 3.1 Full unit suite passes
- [ ] 3.2 Local E2E suite passes
- [ ] 3.3 Type checking passes
- [ ] 3.4 Linting passes
- [ ] 3.5 Environment example and production runbook exist without secret values

#### Manual

- [ ] 3.6 Vercel Production variables are configured for the hosted Supabase project
- [ ] 3.7 Hosted Supabase Auth settings match the selected confirmation behavior
- [ ] 3.8 Deployed production smoke tests pass
- [ ] 3.9 Production failure diagnosis and rollback checklist is actionable
