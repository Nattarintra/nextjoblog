# Sign Up for a New Account — Implementation Plan

## Overview

Build the full sign-up vertical slice: a Supabase server-client helper, a `proxy.ts` session-refresh guard, a `signup` Server Action, and the `/signup` route with its Client Component form — all matching the `scr-signup` design spec and satisfying every acceptance criterion in the user story.

## Current State Analysis

No auth infrastructure exists. The Supabase backend is fully provisioned (email signup enabled, confirmations disabled, `profiles` table with RLS). Next.js 16.3.4 uses `proxy.ts` (renamed from `middleware.ts`, which is silently ignored). `@supabase/ssr` v0.12.5 is installed and requires the `getAll`/`setAll` cookie API. Zod is not installed.

### Key Discoveries

- `proxy.ts` — does not exist; `middleware.ts` is deprecated and silently ignored in Next.js 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`)
- `lib/supabase/` — does not exist; no Supabase client helper anywhere in the codebase
- `app/actions/`, `app/signup/` — do not exist
- A database trigger creates the matching `profiles` row after each `auth.users` insert (`supabase/migrations/20260903100000_create_profile_trigger.sql:1–15`)
- RLS `WITH CHECK (auth.uid() = id)` on `profiles` passes without service-role key because `enable_confirmations = false` makes `signUp()` authenticate immediately (`supabase/config.toml:225`, `supabase/migrations/20260902082511_create_rls_policies.sql:1–3`)
- `cookies()` from `next/headers` is async in Next.js 16 — must be `await`ed
- Minimum password enforced by Supabase: **6 characters** (not 8 — the helper text in the HTML mockup at line 1314 says "At least 6 characters")
- Design tokens, layout, and exact SVG paths live in `supabase/docs/nextjoblog-mvp-screens.html` (template `scr-signup`, lines 1286–1322; styles lines 740–818)
- App fonts are Geist (root layout); auth pages use `Archivo` + `Work Sans` per design spec — load per-page via `next/font/google` to avoid bloating every route

## Desired End State

A user can visit `/signup`, enter an email and password, and click "Sign Up". The system:
1. Validates password length client-side before any network call
2. Calls Supabase Auth, creating an account and establishing a session immediately
3. The database trigger inserts a matching `profiles` row atomically
4. Redirects to `/dashboard`

Duplicate-email submissions show an inline warning with a link to `/login`. The session cookie is refreshed on every navigation via `proxy.ts`. The page matches the `scr-signup` dark navy design spec exactly.

## What We're NOT Doing

- Email verification before first use (confirmations disabled by design)
- Social / OAuth login
- Multi-factor authentication
- Login, forgot-password, or dashboard routes (out of scope for this story)
- Any changes to existing routes or the root layout

## Implementation Approach

Four phases in dependency order: test infrastructure first (Vitest + RTL), then Supabase client + proxy, then the Server Action, then the UI. This ordering means each phase can be verified in isolation before the next builds on it.

## Critical Implementation Details

**`setAll` headers argument**: `@supabase/ssr` v0.12.5's `setAll(cookiesToSet, headers)` passes a second `headers: Record<string, string>` argument containing `Cache-Control: private, no-store` directives. In `proxy.ts` these must be forwarded to the response — omitting them allows CDNs to cache auth responses. In the server client helper the `next/headers` cookie store has no direct header-forwarding API; forwarding the cache headers there is not required because `proxy.ts` covers navigation requests.

**`getClaims()` not `getUser()`**: In `proxy.ts`, use `supabase.auth.getClaims()` to trigger token refresh. It reads the JWT without a network round-trip when the token is still valid, and only calls the Supabase Auth API when a refresh is needed. `getUser()` always makes a network call.

**`redirect()` control flow**: `redirect('/dashboard')` from `next/navigation` throws a Next.js control-flow exception. The `auth.users` profile trigger runs as part of the signup transaction before the action reaches `redirect()` — code after `redirect()` never runs.

---

## Phase 0: Vitest Setup

### Overview

Install and configure Vitest with React Testing Library so every subsequent phase can be verified with automated tests. No production code changes — this phase is purely dev tooling. A smoke test against the existing `app/page.tsx` proves the setup works before real tests are written.

### Changes Required

#### 1. Install dev dependencies

**File**: `package.json` (updated via `npm install`)

**Intent**: Add Vitest, the React plugin, jsdom environment, React Testing Library, and the tsconfig-paths plugin as dev dependencies.

**Contract**: Run:
```
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event vite-tsconfig-paths
```
After install, `package.json` devDependencies must include all six packages.

#### 2. Vitest config

**File**: `vitest.config.mts` (project root)

**Intent**: Configure Vitest to use jsdom as the test environment, resolve `@/*` path aliases from `tsconfig.json`, and transform JSX via the React plugin.

**Contract**: Export a `defineConfig` from `vitest/config` with `plugins: [tsconfigPaths(), react()]` and `test: { environment: 'jsdom' }`. The `tsconfigPaths()` plugin reads the existing `tsconfig.json` — no duplicate path mapping needed.

#### 3. Test script

**File**: `package.json`

**Intent**: Add `"test": "vitest"` and `"test:run": "vitest run"` to the `scripts` block so tests can be run in watch mode (`npm test`) or CI single-pass (`npm run test:run`).

**Contract**: Both scripts must be present in `package.json`. `npm run test:run` must exit with code 0 when all tests pass.

#### 4. Smoke test

**File**: `__tests__/setup.test.tsx`

**Intent**: Verify the Vitest + RTL setup works end-to-end by rendering the existing home page component and asserting it mounts without throwing.

**Contract**: Import `render` from `@testing-library/react` and the default export from `../app/page`. The test calls `render(<Page />)` and asserts the result is defined. This test is intentionally minimal — its only job is to prove the toolchain works.

### Success Criteria

#### Automated Verification

- All dev dependencies installed: `npm ls vitest @vitejs/plugin-react @testing-library/react` exits 0
- `vitest.config.mts` exists: `ls vitest.config.mts`
- Smoke test passes: `npm run test:run`
- TypeScript compiles with no errors: `npx tsc --noEmit`
- Lint passes: `npm run lint`

#### Manual Verification

- `npm test` starts Vitest in watch mode and shows the smoke test as passing in the terminal

---

## Phase 1: Auth Infrastructure

### Overview

Create the two foundational files everything else depends on: the `proxy.ts` session-refresh guard (Next.js 16's replacement for `middleware.ts`) and the `lib/supabase/server.ts` client factory. No UI or business logic yet — just the plumbing that lets server-side code read and write the Supabase session.

### Changes Required

#### 1. Session refresh proxy

**File**: `proxy.ts` (project root, same level as `package.json`)

**Intent**: Intercept every non-static request, create a Supabase client scoped to that request, call `getClaims()` to rotate an expired access token if needed, and return the response with updated `Set-Cookie` headers. Without this, server components and actions will see a null session after the JWT expires.

**Contract**: Named export `proxy(request: NextRequest): Promise<NextResponse>` plus `export const config = { matcher: [...] }`. The matcher must exclude `_next/static`, `_next/image`, and `favicon.ico`. The Supabase client inside `proxy` is constructed with `createServerClient` from `@supabase/ssr` using `getAll` (reads from `request.cookies`) and `setAll` (writes to the `NextResponse` and forwards the `headers` argument to response headers).

#### 2. Server Supabase client factory

**File**: `lib/supabase/server.ts`

**Intent**: Single factory function used by Server Actions and Server Components to get an authenticated Supabase client. Keeps the `@supabase/ssr` cookie wiring in one place so call sites stay clean.

**Contract**: `export async function createServerSupabaseClient(): Promise<SupabaseClient>`. The function must `await cookies()` from `next/headers`, then pass `getAll`/`setAll` to `createServerClient`. The `setAll` implementation calls `cookieStore.set()` for each cookie inside a try/catch — some rendering contexts (static generation) cannot write cookies and will throw; swallowing the error is correct. Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not the service role key).

### Success Criteria

#### Automated Verification

- TypeScript compiles with no errors: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- `proxy.ts` exports a function named `proxy` (not `middleware`) and a `config` object — grep check: `grep -n "export.*function proxy\|export const config" proxy.ts`
- `lib/supabase/server.ts` exports `createServerSupabaseClient` — grep check: `grep -n "createServerSupabaseClient" lib/supabase/server.ts`

#### Manual Verification

- `npm run dev` starts without errors
- Navigating to `http://localhost:3000` shows no console errors related to Supabase or cookies

---

## Phase 2: Sign-up Server Action

### Overview

Implement the `signup` Server Action in `app/actions/auth.ts`. This is the only application file that touches Supabase Auth; the database trigger provisions the matching `profiles` row. It is invoked by the form in Phase 3 via `useActionState`.

### Changes Required

#### 1. Server Action and form state type

**File**: `app/actions/auth.ts`

**Intent**: Validate the submitted email and password, call `supabase.auth.signUp()`, rely on the database trigger to insert the matching `profiles` row atomically, and redirect to `/dashboard`. Return a typed error state when validation fails or Supabase returns an error, so the form can render the right error UI without a full page reload.

**Contract**:
- File-level `'use server'` directive.
- Exported type `SignupFormState`: discriminated union — `undefined` (initial) | `{ error: 'duplicate_email' }` | `{ error: 'weak_password' }` | `{ error: 'unknown'; message: string }`.
- Exported function `signup(_state: SignupFormState, formData: FormData): Promise<SignupFormState>`.
- Return `{ error: 'weak_password' }` if `password.length < 6` — this guard fires before any Supabase call, satisfying the AC that the error appears "before the request is sent to Supabase".
- Map Supabase `AuthApiError` with `code === 'user_already_exists'` or message containing `'already registered'` to `{ error: 'duplicate_email' }`.
- The `after insert on auth.users` trigger in `supabase/migrations/20260903100000_create_profile_trigger.sql` creates `{ id: data.user.id }` in `profiles` as part of the same database transaction; a trigger failure must abort account creation.
- Call `redirect('/dashboard')` as the final step after `signUp()` succeeds. **Critical**: `redirect()` throws a Next.js control-flow exception (`NEXT_REDIRECT`). It must be called **outside** any try/catch block — if called inside one, the exception is caught and the redirect is silently lost. Structure the action as: try/catch for Supabase signup → early returns for error states → `redirect()` unconditionally after the try/catch.

#### 2. Atomic profile provisioning migration

**File**: `supabase/migrations/20260903100000_create_profile_trigger.sql`

**Intent**: Create the default profile automatically whenever Supabase Auth creates a user, keeping account and profile creation atomic.

**Contract**: Define a `security definer` trigger function with an explicit empty `search_path`, insert only the new user ID into `public.profiles`, and attach it as an `after insert` trigger on `auth.users`.

### Success Criteria

#### Automated Verification

- TypeScript compiles with no errors: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- `'use server'` directive present: `grep -n "use server" app/actions/auth.ts`
- `SignupFormState` type exported: `grep -n "export type SignupFormState" app/actions/auth.ts`
- `signup` function exported: `grep -n "export async function signup" app/actions/auth.ts`

#### Manual Verification

- Using a REST client or `curl`, a POST to the Server Action endpoint with a short password returns `{ error: 'weak_password' }` (or a redirect to the form with that state)
- Submitting with a valid new email+password creates a row in `auth.users` and the trigger creates a matching row in `profiles` (verify in Supabase dashboard or local Studio at `http://localhost:54323`)
- Submitting with an already-registered email returns `{ error: 'duplicate_email' }`

---

## Phase 3: Sign-up UI

### Overview

Create the `/signup` route with the full design-spec UI. Two files: a thin Server Component page and a Client Component form that wires to the `signup` Server Action via `useActionState`.

### Changes Required

#### 1. Route page

**File**: `app/signup/page.tsx`

**Intent**: Provide the Next.js route segment for `/signup`. Load the auth-page fonts (`Archivo` for headings, `Work Sans` for body text) scoped to this page only — the root layout uses Geist and must not change. Render the full-viewport dark navy container with `SignupForm` inside it.

**Contract**: Default Server Component export with `export const metadata: Metadata = { title: 'Create Account — NextJobLog' }`. Load `Archivo` (weight 700) and `Work_Sans` (weights 400, 600) via `next/font/google` as CSS variable fonts. Apply both `variable` classes to the outermost wrapper div so child components can reference `var(--font-archivo)` and `var(--font-work-sans)`. Background color `#042c53` (--navy), `min-height: 100svh`, centered flex layout.

#### 2. Sign-up form component

**File**: `app/signup/SignupForm.tsx`

**Intent**: Client Component form that collects email and password, performs client-side password length validation before invoking the Server Action, displays the duplicate-email alert when `state.error === 'duplicate_email'`, shows a pending state on the submit button, and matches the `scr-signup` design spec exactly.

**Contract**: `'use client'` directive. Uses `useActionState(signup, undefined)` from React — destructure as `[state, formAction, isPending]`. The `<form>` has both `action={formAction}` and `onSubmit` handler: the handler reads password length from the form data; if `< 6`, calls `e.preventDefault()`, sets local `passwordError` state, and returns — no Server Action call is made. If `>= 6`, clears `passwordError` and lets the form action proceed.

UI elements in DOM order (matching `scr-signup` template lines 1286–1322):
- Decorative radial glow (absolute positioned, top-right)
- Logo mark SVG (40×40, exact paths from mockup lines 1293–1298)
- Heading "Create Your NextJobLog Account"
- Subtitle "Your application data is encrypted and visible only to you."
- Conditional duplicate-email alert (rendered only when `state?.error === 'duplicate_email'`): warning amber style, triangle SVG icon, text "This email is already in use — **Log In** instead" where "Log In" is a `<Link href="/login">` with underline
- Email field (label "Email", `type="email"`, `name="email"`, `required`)
- Password field (label "Password", `type="password"`, `name="password"`, `required`): always-visible helper text "At least 6 characters" below the input; `passwordError` state shown as a second line when present
- Spacer div
- Submit button "Sign Up" (disabled + text "Creating account…" when `isPending`)
- Footer "Already have an account? Log In" where "Log In" is `<Link href="/login">`

Style values are specified in the design spec (`supabase/docs/nextjoblog-mvp-screens.html` lines 740–818). Focus ring on inputs (`outline: 2px solid #1976d2`) requires a scoped `<style>` element inside the component since inline React styles cannot express `:focus` pseudo-class — use a specific class name (e.g. `njl-auth-input`) to avoid global conflicts.

#### 3. SignupForm unit tests

**File**: `__tests__/SignupForm.test.tsx`

**Intent**: Verify the Client Component renders correctly in all three states (initial, duplicate-email error, pending) and that the `onSubmit` handler blocks the Server Action call when the password is too short — without needing a real Supabase connection or Next.js server.

**Contract**: Four test cases using `render` from `@testing-library/react` and `userEvent` from `@testing-library/user-event`:
1. Default render — email input, password input, "Sign Up" button, and footer "Log In" link are present
2. `state.error === 'duplicate_email'` — the amber alert containing "already in use" is visible; email and password fields are still rendered
3. Short password submit — mock the form action, simulate typing a 3-char password and clicking submit, assert the mock was NOT called and the password error text is visible
4. `isPending === true` — button text is "Creating account…" and button is disabled

Mock `signup` from `@/app/actions/auth` via `vi.mock` so no Server Action runs during tests.

### Success Criteria

#### Automated Verification

- TypeScript compiles with no errors: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- `npm run build` completes without errors (validates the full app including font loading and Server Action binding)
- `'use client'` directive present: `grep -n "use client" app/signup/SignupForm.tsx`
- Route page exists: `ls app/signup/page.tsx`
- Unit tests pass: `npm run test:run`

#### Manual Verification

- `http://localhost:3000/signup` renders without JS errors
- Page background is dark navy (`#042c53`), text is white, fonts are Archivo/Work Sans (not Geist)
- Logo SVG, heading, subtitle, email field, password field, submit button, and footer link all render correctly and match the `scr-signup` mockup
- Submitting with password `abc` (3 chars) shows "At least 6 characters" error **without** a network request (check Network tab — no Server Action call fired)
- Submitting with password `abcdef` (6 chars) and a new email creates an account and redirects to `/dashboard` (404 is expected — `/dashboard` does not exist yet)
- Submitting with an already-registered email shows the amber duplicate-email alert with a "Log In" link pointing to `/login`
- The "Log In" link in the footer navigates to `/login` (404 expected — not yet built)
- Submit button shows "Creating account…" and is disabled while the Server Action is running

---

---

## Phase 4: Playwright E2E Tests

### Overview

Install Playwright and write E2E tests that cover every acceptance criterion by driving a real browser against the running Next.js app and a real Supabase instance. This is the only layer that can verify the full vertical slice — client validation, Server Action, Supabase Auth, trigger-based profile provisioning, and redirect — because Vitest cannot reach async Server Components or Server Actions.

### Changes Required

#### 1. Install and configure Playwright

**File**: `playwright.config.ts` (project root), `package.json`

**Intent**: Install Playwright directly (non-interactive) and create `playwright.config.ts` by hand. Configure it to point at the `e2e/` directory, set `baseURL` to `http://localhost:3000`, and configure `webServer` to auto-start the Next.js dev server before the test run. Add a `test:e2e` script to `package.json`.

**Contract**:
- Install via: `npm install -D @playwright/test && npx playwright install chromium` (non-interactive; avoids `npm init playwright` wizard)
- Create `playwright.config.ts` and `e2e/` directory by hand
- `playwright.config.ts` must include:
  - `testDir: './e2e'`
  - `use: { baseURL: 'http://localhost:3000' }`
  - `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI }`
- `package.json` scripts: `"test:e2e": "playwright test"`

#### 2. E2E test file

**File**: `e2e/signup.spec.ts`

**Intent**: Cover all four acceptance criterion scenarios with real browser interactions against the running app and Supabase.

**Contract**: Four test cases using `page` fixture from `@playwright/test`:

1. **Happy path** — navigate to `/signup`, fill in a unique timestamped email (e.g. `test+<Date.now()>@example.com`) and password `abcdef`, click "Sign Up", assert URL changes to `/dashboard` (a 404 page is acceptable — the redirect itself is what's verified)

2. **Boundary — minimum password length** — same flow with password exactly `abcdef` (6 chars); assert redirect to `/dashboard` (account created, not rejected)

3. **Duplicate email error** — use `test.beforeAll` to sign up once with a fixed seed email (`duplicate@example.com`); wrap the signup call in a try/catch that ignores `user_already_exists` errors so re-runs without `supabase db reset` don't break `beforeAll`. Then in the test submit the same email again; assert the amber alert containing "already in use" is visible and a "Log In" link is present on the page

4. **Short password client-side guard** — navigate to `/signup`, fill email, type a 3-char password `abc`, click "Sign Up"; assert the page URL is still `/signup` (no redirect), the password error text is visible, and the Network panel recorded no Server Action POST (use `page.on('request', ...)` to assert no `_next/action` request fired)

**Cleanup note**: Happy-path and boundary tests create real `auth.users` rows. Use unique timestamped emails to avoid inter-run collisions. Test users accumulate in dev Supabase — acceptable for local dev. In CI, run `supabase db reset` before the test suite to start clean.

#### 3. Linux CI workflow

**File**: `.github/workflows/playwright.yml`

**Intent**: Run the Playwright suite on Ubuntu because local Chromium execution is unavailable on the development Mac. The workflow starts a disposable local Supabase instance, resets it to the repository migrations, installs Chromium with system dependencies, runs `npm run test:e2e`, and uploads the HTML report even when tests fail.

**Contract**:
- Run on Ubuntu for pushes, pull requests, and manual dispatch.
- Install Node dependencies with `npm ci` and install the Supabase CLI.
- Run `supabase start`, then `supabase db reset` before the E2E suite.
- Export the local Supabase URL and anon key to the job environment.
- Run `npx playwright install --with-deps chromium` and `npm run test:e2e`.
- Upload `playwright-report/` as an artifact regardless of test outcome.

#### 4. Supabase CLI compatibility configuration

**File**: `supabase/config.toml`

**Intent**: Keep local Supabase configuration compatible with the current CLI and CI workflow.

**Changes**:
- Rename the deprecated `[local_smtp]` section to `[inbucket]`.
- Remove the obsolete experimental `[experimental.pgdelta]` configuration.

These changes are required for reliable local Supabase startup and database reset in CI.

### Success Criteria

#### Automated Verification

- Playwright installed and browsers downloaded: `npx playwright install --dry-run` exits 0
- `playwright.config.ts` exists with correct `testDir` and `baseURL`: `grep -n "testDir\|baseURL" playwright.config.ts`
- `e2e/signup.spec.ts` exists: `ls e2e/signup.spec.ts`
- All four E2E tests pass: `npm run test:e2e`

#### Manual Verification

- Running `npm run test:e2e` starts the dev server automatically (via `webServer` config), opens Chromium, and all four tests pass with green output
- The Playwright HTML report (`npx playwright show-report`) shows all scenarios with correct pass/fail status

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

**`SignupForm.tsx` — Client Component (fully testable):**
- Renders email field, password field, submit button, and footer link
- Shows the duplicate-email alert when `state.error === 'duplicate_email'`; hides it otherwise
- Shows `passwordError` local state when `onSubmit` intercepts a short password; does not call the form action
- Submit button renders as disabled and shows "Creating account…" text when `isPending` is true

**Validation logic — pure function (if extracted from the Server Action):**
- `password.length < 6` maps to `weak_password`
- Supabase error `code === 'user_already_exists'` maps to `duplicate_email`
- Supabase error message containing `'already registered'` maps to `duplicate_email`

**What Vitest cannot test** (async Server Components/Actions — Next.js docs confirmed limitation):
- `proxy.ts` — requires the full Next.js request lifecycle
- `lib/supabase/server.ts` — depends on `next/headers` which is not available in jsdom
- `signup` Server Action end-to-end — async server function; needs E2E

### E2E Tests (Playwright — Phase 4)

These cover what Vitest cannot — the full server-side stack including the Server Action, Supabase Auth, and the `profiles` insert:

- **Happy path**: fill form with new email + `abcdef` → redirect to `/dashboard`
- **Boundary case**: password exactly 6 chars → redirect to `/dashboard` (not rejected)
- **Duplicate email**: submit already-registered email → amber alert with "Log In" link visible
- **Short password (client guard)**: type 3-char password → URL stays `/signup`, error text visible, no `_next/action` network request fired

### Manual Testing Steps

1. Run `npm run dev` and open `http://localhost:3000/signup`
2. **Happy path**: enter a fresh email + password `abcdef` → click "Sign Up" → confirm redirect to `/dashboard` (404) → verify in Supabase Studio that the trigger created matching `auth.users` and `profiles` rows
3. **Boundary case**: repeat with password exactly `abcdef` (6 chars) → confirm account created
4. **Short password**: enter any email + password `abc` → click "Sign Up" → confirm the "At least 6 characters" error appears, confirm no network request in DevTools
5. **Duplicate email**: submit the same email again → confirm the amber duplicate-email alert appears with underlined "Log In" text
6. **Footer link**: click "Log In" in footer → confirm it navigates to `/login` (404 expected)
7. **Pending state**: on a slow connection (DevTools throttle), confirm button shows "Creating account…" and is disabled during submission

## References

- Research: `context/change/sign-up-for-a-new-account/research.md`
- Design mockup: `supabase/docs/nextjoblog-mvp-screens.html` (template `scr-signup` lines 1286–1322, auth styles lines 740–818)
- Profiles table DDL: `supabase/migrations/20260902082510_create_tables.sql:1–8`
- RLS policies: `supabase/migrations/20260902082511_create_rls_policies.sql:1–3`
- proxy.ts convention: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- Auth form pattern: `node_modules/next/dist/docs/01-app/02-guides/authentication.md:33–296`
- `@supabase/ssr` cookie API: `node_modules/@supabase/ssr/dist/module/createServerClient.d.ts:8–78`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Vitest Setup

#### Automated

- [x] 0.1 All dev dependencies installed — 15e8b10
- [x] 0.2 vitest.config.mts exists — 15e8b10
- [x] 0.3 Smoke test passes — 15e8b10
- [x] 0.4 TypeScript compiles with no errors — 15e8b10
- [x] 0.5 Lint passes — 15e8b10

#### Manual

- [x] 0.6 npm test starts Vitest in watch mode with smoke test passing — 15e8b10

### Phase 1: Auth Infrastructure

#### Automated

- [x] 1.1 TypeScript compiles with no errors — 0225a23
- [x] 1.2 Lint passes — 0225a23
- [x] 1.3 proxy.ts exports `proxy` function and `config` object — 0225a23
- [x] 1.4 lib/supabase/server.ts exports `createServerSupabaseClient` — 0225a23

#### Manual

- [x] 1.5 Dev server starts without errors — 0225a23
- [x] 1.6 No console errors on home page navigation — 0225a23

### Phase 2: Sign-up Server Action

#### Automated

- [x] 2.1 TypeScript compiles with no errors — 666169d
- [x] 2.2 Lint passes — 666169d
- [x] 2.3 `use server` directive present in auth.ts — 666169d
- [x] 2.4 `SignupFormState` type exported — 666169d
- [x] 2.5 `signup` function exported — 666169d

#### Manual

- [x] 2.6 Valid new credentials create auth.users and profiles rows — 666169d
- [x] 2.7 Duplicate email returns duplicate_email error — 666169d
- [x] 2.8 Short password returns weak_password error before Supabase call — 666169d

### Phase 3: Sign-up UI

#### Automated

- [x] 3.1 TypeScript compiles with no errors — bb5a92a
- [x] 3.2 Lint passes — bb5a92a
- [x] 3.3 npm run build completes without errors — bb5a92a
- [x] 3.4 `use client` directive present in SignupForm.tsx — bb5a92a
- [x] 3.5 Route page file exists at app/signup/page.tsx — bb5a92a
- [x] 3.6 SignupForm unit tests pass — bb5a92a

#### Manual

- [x] 3.7 Page renders at /signup with correct dark navy design — bb5a92a
- [x] 3.8 Short password shows error without network request — bb5a92a
- [x] 3.9 Valid sign-up redirects to /dashboard — bb5a92a
- [x] 3.10 Duplicate email shows amber alert with Log In link — bb5a92a
- [x] 3.11 Submit button shows pending state during submission — bb5a92a

### Phase 4: Playwright E2E Tests

#### Automated

- [x] 4.1 Playwright installed and browsers downloaded — 54b7994 — CI run: https://github.com/Nattarintra/nextjoblog/actions/runs/33911904826
- [x] 4.2 playwright.config.ts exists with correct testDir and baseURL — CI run: https://github.com/Nattarintra/nextjoblog/actions/runs/33911904826
- [x] 4.3 e2e/signup.spec.ts exists — CI run: https://github.com/Nattarintra/nextjoblog/actions/runs/33911904826
- [x] 4.4 All four E2E tests pass — 54b7994 — CI run: https://github.com/Nattarintra/nextjoblog/actions/runs/33911904826

#### Manual

- [x] 4.5 npm run test:e2e starts dev server automatically and all tests pass — 54b7994 — CI run: https://github.com/Nattarintra/nextjoblog/actions/runs/33911904826
- [x] 4.6 Playwright HTML report shows all four scenarios with correct status — 54b7994 — artifact from CI run: https://github.com/Nattarintra/nextjoblog/actions/runs/33911904826
