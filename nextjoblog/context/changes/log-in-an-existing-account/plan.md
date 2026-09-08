# Log In to an Existing Account — Implementation Plan

## Overview

Add a `login` Server Action and a `/login` route that mirror the sign-up vertical slice: same Server-Action-plus-`useActionState` pattern, same Supabase client factory, same Tailwind design-token approach — but with login's own (simpler) field components and its own two-state error taxonomy that satisfies the anti-enumeration and case-insensitivity ACs by construction.

## Current State Analysis

All shared auth infrastructure already exists and is reused as-is (no changes to any of these):

- `proxy.ts` — session-refresh guard, matches every non-static route already; no route-guarding logic exists or is added here (confirmed out of scope — GitHub issue #6 / Story 0.4 owns that).
- `lib/supabase/server.ts` — `createServerSupabaseClient()` factory.
- `app/actions/auth.ts` — currently holds only the `signup` action; this plan adds `login` alongside it in the same file.
- `app/signup/styles.ts`, `app/signup/AuthLogo.tsx`, `components/Logo.tsx` — reusable presentational exports with no signup-specific logic.
- Vitest (`vitest.config.mts`) and Playwright (`playwright.config.ts`, CI workflow) are fully configured; no new dependencies needed.
- `public.applications`, `cv_documents`, `status_history`, `reminders`, `conversation_notes` — all five RLS-protected tables named in this story's Non-Functional AC **already exist** with owner-scoped RLS policies (`supabase/migrations/20260902082510_create_tables.sql`, `20260902082511_create_rls_policies.sql`). This means the RLS non-functional AC is concretely testable in this task, not a placeholder for future work.

### Key Discoveries:

- Supabase's `signInWithPassword` returns the **same** `invalid_credentials` error code regardless of whether the email or the password was wrong (`node_modules/@supabase/auth-js/src/lib/fetch.ts:79-146`) — the anti-enumeration AC is satisfied by simply not branching on which field failed, not by new logic.
- Email case-insensitivity is a server/Postgres guarantee, not a client-side one — no `.toLowerCase()` should be added to the login action.
- Login has no password-shape validation (unlike signup's 6-character minimum), so it needs no client-side `onSubmit` interception at all — the form can rely on `formAction` and native `required` attributes directly.
- `--danger-tint`/`--danger-fg` design tokens used by the login error alert don't exist yet in `app/globals.css` (only `--warning-tint`/`--warning-fg`/`--auth-danger` do).

## Desired End State

A user can visit `/login`, enter their email and password, and click "Log In". The system:
1. Rejects an obviously malformed email before any network call.
2. Calls Supabase Auth; on success, establishes a session and redirects to `/dashboard` (404 expected — same accepted state as signup, since the dashboard route doesn't exist yet).
3. On any credential failure (wrong email, wrong password, or unregistered email), shows the identical "Email or password is incorrect" message, with no way to distinguish which field was wrong.
4. Case-differing email input (e.g. `User@Example.com`) authenticates successfully against a lowercase-registered account.
5. Once authenticated, the session's JWT is what every RLS policy on `applications`/`cv_documents`/`status_history`/`reminders`/`conversation_notes` keys off — verified end-to-end with a real query, not just asserted from the schema.

**Verification**: `npm run test:run` (Vitest) and `npm run test:e2e` (Playwright) both pass; manual walkthrough of `/login` matches the `scr-login` design mockup.

## What We're NOT Doing

- Route-guarding / redirecting unauthenticated users away from protected pages (Story 0.4, GitHub issue #6 — depends on this task, not the reverse).
- The `/forgot-password` destination page (link renders per the design mockup and 404s for now, same convention as signup's pre-existing `/login` link).
- The `/dashboard` page itself.
- Social login, MFA, app-level rate limiting (Supabase's built-in `sign_in_sign_ups = 30` limit already applies with no code change).
- A dedicated "too many attempts" UI state for `over_request_rate_limit` — bucketed into the generic error message per planning decision.
- Any refactor of `app/signup/`'s existing, shipped, already-reviewed components or tests.

## Implementation Approach

Three phases in dependency order, mirroring how sign-up was built (this reuses that story's Phase 2–4 shape; Phase 0/1 infra work is already done): Server Action first (so it can be verified independently of any UI), then the UI that calls it, then Playwright E2E to exercise the server-side guarantees (case-insensitivity, anti-enumeration, RLS scoping) that no unit test can reach.

## Critical Implementation Details

**Error taxonomy is intentionally 2-state.** `LoginFormState` is `undefined | { error: 'invalid_credentials' } | { error: 'unknown'; message: string }`. Every Supabase failure that isn't a local email-format rejection — including `over_request_rate_limit` — maps to `unknown` with a fixed generic message; only the specific error code is `console.error`'d for server-side observability. Do not add a third UI-facing state.

**Cross-feature imports are read-only.** `LoginForm.tsx` imports `authInputClassName`/`authFieldLabelClassName`/`authLinkClassName` from `@/app/signup/styles` and `AuthLogo` from `@/app/signup/AuthLogo` — both are logic-free presentational exports. Do not modify either file, and do not duplicate their contents into `app/login/`.

**No client-side `onSubmit` handler needed.** Unlike `SignupForm`, `LoginForm` has nothing to validate client-side beyond native `required` — do not port `SignupForm`'s `handleSubmit`/local-state pattern over; a bare `<form action={formAction}>` is correct here.

**Uniform `aria-invalid` without revealing which field failed.** When `state?.error` is set (either variant), both the email and password inputs get `aria-invalid="true"` identically — this signals "something is wrong" to assistive tech without hinting which field, preserving the anti-enumeration property at the accessibility layer too.

## Phase 1: Login Server Action

### Overview

Add the `login` Server Action to the existing `app/actions/auth.ts`, alongside `signup`.

### Changes Required:

#### 1. Login action and form state type

**File**: `app/actions/auth.ts`

**Intent**: Validate the submitted email's shape, call `supabase.auth.signInWithPassword()`, map any failure to the two-state `LoginFormState` without ever branching on which credential was wrong, and redirect to `/dashboard` on success.

**Contract**:
- Exported type `LoginFormState`: `undefined | { error: 'invalid_credentials' } | { error: 'unknown'; message: string }`.
- Exported function `login(_state: LoginFormState, formData: FormData): Promise<LoginFormState>`.
- Reuse the same email-shape regex already used by `signup` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) — malformed email returns `{ error: 'unknown', message: 'Please enter a valid email address.' }` before any Supabase call.
- A helper type guard `isInvalidCredentialsError(error: unknown): boolean` (mirroring `isDuplicateEmailError`'s shape) checks `isAuthApiError(error) && error.code === 'invalid_credentials'`.
- Any other error (including `over_request_rate_limit` or a thrown non-Auth error) is `console.error`'d with its code/message and mapped to `{ error: 'unknown', message: 'Unable to log in. Please try again.' }`.
- `redirect('/dashboard')` is called unconditionally after the try/catch, never inside it — same control-flow rule as `signup`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles with no errors: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- `login` function exported: `grep -n "export async function login" app/actions/auth.ts`
- `LoginFormState` type exported: `grep -n "export type LoginFormState" app/actions/auth.ts`

#### Manual Verification:

- Submitting correct credentials via a REST client establishes a session and reaches the redirect
- Submitting a wrong password returns `{ error: 'invalid_credentials' }`
- Submitting an unregistered email returns the **identical** `{ error: 'invalid_credentials' }` — confirms anti-enumeration at the action layer, not just in the UI copy
- Submitting a malformed email (no `@`) returns `{ error: 'unknown', message: 'Please enter a valid email address.' }` before any network call

---

## Phase 2: Login UI

### Overview

Build the `/login` route and its component tree, matching the `scr-login` design mockup, wired to the `login` Server Action.

### Changes Required:

#### 1. Design tokens

**File**: `app/globals.css`

**Intent**: Add the danger color pair the login error alert needs, following the exact naming pattern already established by `--warning-tint`/`--warning-fg`.

**Contract**: Add `--danger-tint: #fbe9e7;` and `--danger-fg: #8a271f;` under `:root`, and `--color-danger-tint: var(--danger-tint);` / `--color-danger-fg: var(--danger-fg);` under `@theme inline`. No raw `--danger` token — the icon reuses `stroke-danger-fg`, matching how `DuplicateEmailAlert` reuses `stroke-warning-fg` rather than a separate raw color.

#### 2. Route page

**File**: `app/login/page.tsx`

**Intent**: Route segment for `/login`, structurally identical to `app/signup/page.tsx`.

**Contract**: Default Server Component, `export const metadata: Metadata = { title: 'Log In — NextJobLog' }`, loads `Archivo`/`Work_Sans` the same way as the signup page, renders the dark navy full-viewport wrapper containing `LoginForm`.

#### 3. Login form component

**File**: `app/login/LoginForm.tsx`

**Intent**: Client Component that renders the auth shell (logo, heading, subtitle), the conditional error alert, the fields, and the footer link back to sign-up.

**Contract**: `'use client'`. `useActionState(login, undefined)` destructured as `[state, formAction, isPending]`. No local component state and no `onSubmit` handler (see Critical Implementation Details). Heading "Log In", subtitle "Log your job applications and track every step in one place." When `state?.error === 'invalid_credentials'`, render `<LoginErrorAlert message="Email or password is incorrect" />`; when `state?.error === 'unknown'`, render `<LoginErrorAlert message={state.message} />`. Footer: "Don't have an account? Sign Up" linking to `/signup`.

#### 4. Login fields component

**File**: `app/login/LoginFields.tsx`

**Intent**: The `<form>` itself — email input, password input (no helper text, no validation-message plumbing), the "Forgot password?" link, and the submit button.

**Contract**: Email input (`type="email"`, `name="email"`, `required`, `aria-invalid={hasError}`), password input (`type="password"`, `name="password"`, `required`, `aria-invalid={hasError}`) — `hasError` is `state?.error !== undefined`, applied identically to both fields. Right-aligned `<Link href="/forgot-password">Forgot password?</Link>` above the submit button, styled with `authLinkClassName`. Submit button text: `isPending ? "Logging in…" : "Log In"`, `disabled={isPending}`.

#### 5. Login error alert component

**File**: `app/login/LoginAlert.tsx`

**Intent**: One alert component parameterized by message — login only ever shows one visual alert shape (unlike signup's two differently-shaped alerts), just with different text depending on which `LoginFormState` variant fired.

**Contract**: `export function LoginErrorAlert({ message }: { message: string })`. `role="alert"`, `data-testid="login-alert"`, background/text using the new `bg-danger-tint`/`text-danger-fg` tokens, circle-exclamation icon (path copied from `supabase/docs/nextjoblog-mvp-screens.html:1250-1283`) using `stroke-danger-fg`.

#### 6. LoginForm unit tests

**File**: `__tests__/login/LoginForm.test.tsx`

**Intent**: Verify rendering in all three states without a real Supabase connection, following the same `vi.hoisted`/`useActionState` mocking pattern as `__tests__/signup/SignupForm.test.tsx`.

**Contract**: Test cases —
1. Default render: email field, password field, "Log In" button, "Forgot password?" link, and "Sign Up" footer link are present.
2. `state.error === 'invalid_credentials'`: alert shows exactly "Email or password is incorrect"; both fields remain visible and rendered `aria-invalid="true"`.
3. `state.error === 'unknown'`: alert shows the server-provided message verbatim.
4. `isPending === true`: button text is "Logging in…" and disabled.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles with no errors: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- `npm run build` completes without errors
- `'use client'` directive present: `grep -n "use client" app/login/LoginForm.tsx`
- Route page exists: `ls app/login/page.tsx`
- Unit tests pass: `npm run test:run`

#### Manual Verification:

- `http://localhost:3000/login` renders matching the `scr-login` mockup: dark navy background, logo, heading, subtitle, fields, forgot-password link, submit button, footer
- The new danger-tint/danger-fg alert colors render with adequate contrast when an error is shown
- Tab order moves logically: email → password → forgot-password link → submit button → footer link
- A screen reader announces the error alert via `role="alert"` when credentials are invalid

---

## Phase 3: Playwright E2E Tests

### Overview

Cover every acceptance criterion end-to-end against a real Next.js server and real Supabase instance — the only layer that can verify Supabase's actual case-insensitivity, anti-enumeration, and RLS-scoping guarantees.

### Changes Required:

#### 1. E2E test file

**File**: `e2e/login.spec.ts`

**Intent**: Drive the real `/login` page and, for the RLS check, the Supabase client directly, covering all four ACs.

**Contract**: `test.describe.configure({ mode: "default" })`, same rationale as `signup.spec.ts` (a shared seeded user must not race across parallel workers). `test.beforeAll` seeds one fixed lowercase-email user via the `/signup` page (ignoring an "already in use" result on reruns, same pattern as `signup.spec.ts`'s `beforeAll`). Test cases:

1. **Happy path** — correct email + password → `expect(page).toHaveURL(/\/dashboard$/)`.
2. **Case-insensitive email** — same password, email submitted with mixed case (e.g. uppercasing the local part) → same redirect assertion.
3. **Wrong password** — correct email, wrong password → `LoginAlert`'s `data-testid="login-alert"` contains exactly "Email or password is incorrect"; URL stays `/login`.
4. **Unregistered email** — a never-seeded email, any password → the **same** alert text as test 3 (this is the assertion that proves anti-enumeration, not just that an error appears).
5. **RLS scoping (Non-Functional AC)** — seed a second user via the admin client; insert one minimal `applications` row per user directly via the service-role client (bypassing RLS to set up fixture data). `applications` has five NOT NULL columns with no default beyond `user_id` (`supabase/migrations/20260902082510_create_tables.sql:27-31`), so each fixture row's insert payload must be `{ user_id, title, company, applied_date, location, posting_url }` (arbitrary valid values for the non-`user_id` fields — everything else on the table is nullable or defaulted). Sign in via `supabase-js` with the anon key as the first user (`signInWithPassword`, no browser needed for this assertion) and run an unfiltered `select('*').from('applications')`; assert exactly one row is returned and its `user_id` matches the signed-in user, never the second user's row — this is the "even through a malformed query" guarantee from the AC, exercised directly rather than inferred from the schema.

### Success Criteria:

#### Automated Verification:

- `e2e/login.spec.ts` exists: `ls e2e/login.spec.ts`
- All login E2E tests pass: `npm run test:e2e`

#### Manual Verification:

- `npx playwright show-report` shows all login scenarios passing
- Confirm the deployed/staging environment's `NEXT_PUBLIC_SUPABASE_URL` uses `https://` — the HTTPS/TLS AC is a Supabase-client/environment-configuration guarantee, not something a local Playwright run against `http://localhost` can meaningfully assert

---

## Testing Strategy

### Unit Tests (Vitest):

- `LoginForm` renders all three states (default, `invalid_credentials`, `unknown`) and the pending state correctly, without a real Supabase connection.

### Integration/E2E Tests (Playwright):

- Happy path, case-insensitive login, wrong password, unregistered email (anti-enumeration), and RLS scoping — see Phase 3 above. Every stated Acceptance Criterion (Happy Path, Edge Case, Error Handling, both Non-Functional items) has at least one direct automated test; the HTTPS/TLS item is the sole exception, verified manually per-environment as noted above.

### Manual Testing Steps:

1. Run `npm run dev`, open `http://localhost:3000/login`.
2. Log in with a valid seeded account → confirm redirect to `/dashboard` (404 expected).
3. Log in with the same email in a different case → confirm it still succeeds.
4. Log in with a wrong password → confirm the generic "Email or password is incorrect" alert.
5. Log in with an email that was never registered → confirm the identical alert text as step 4.
6. Confirm the "Forgot password?" link navigates to `/forgot-password` (404 expected) and the footer "Sign Up" link navigates to `/signup`.
7. Throttle the network in DevTools and confirm the button shows "Logging in…" and is disabled while pending.

## Performance Considerations

None beyond what already applies to `signup` — `signInWithPassword` is a single network round-trip; no new caching or heavy computation is introduced.

## Migration Notes

None — no schema changes. The RLS-protected tables and policies this story's Non-Functional AC references already exist from prior migrations.

## References

- Research: `context/changes/log-in-an-existing-account/research.md`
- Prior implementation template: `context/changes/sign-up-for-a-new-account/plan.md`
- Design mockup: `supabase/docs/nextjoblog-mvp-screens.html:1250-1283` (`scr-login`), `:23-24,723-726` (`.alert-danger` tokens)
- Server Action pattern: `app/actions/auth.ts:1-79`
- Table/RLS definitions: `supabase/migrations/20260902082510_create_tables.sql`, `20260902082511_create_rls_policies.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Login Server Action

#### Automated

- [x] 1.1 TypeScript compiles with no errors — 97ed740
- [x] 1.2 Lint passes — 97ed740
- [x] 1.3 `login` function exported — 97ed740
- [x] 1.4 `LoginFormState` type exported — 97ed740

#### Manual

- [x] 1.5 Correct credentials establish a session and reach the redirect — 97ed740
- [x] 1.6 Wrong password returns `invalid_credentials` — 97ed740
- [x] 1.7 Unregistered email returns the identical `invalid_credentials` — 97ed740
- [x] 1.8 Malformed email returns `unknown` before any network call — 97ed740

### Phase 2: Login UI

#### Automated

- [x] 2.1 TypeScript compiles with no errors — 0e02c99
- [x] 2.2 Lint passes — 0e02c99
- [x] 2.3 npm run build completes without errors — 0e02c99
- [x] 2.4 `use client` directive present in LoginForm.tsx — 0e02c99
- [x] 2.5 Route page exists at app/login/page.tsx — 0e02c99
- [x] 2.6 LoginForm unit tests pass — 0e02c99

#### Manual

- [x] 2.7 /login renders matching the scr-login design — 0e02c99
- [x] 2.8 Danger-tint/danger-fg alert colors render with adequate contrast — 0e02c99
- [x] 2.9 Tab order moves logically through all interactive elements — 0e02c99
- [x] 2.10 Screen reader announces the error alert via role="alert" — 0e02c99

### Phase 3: Playwright E2E Tests

#### Automated

- [ ] 3.1 e2e/login.spec.ts exists
- [ ] 3.2 All login E2E tests pass

#### Manual

- [ ] 3.3 Playwright HTML report shows all login scenarios passing
- [ ] 3.4 Staging/production NEXT_PUBLIC_SUPABASE_URL confirmed https://
