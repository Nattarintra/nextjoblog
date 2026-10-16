# Fix expired-session sign-out scope Implementation Plan

## Overview

`GET /api/auth/session-expired` ends an app-expired (but provider-valid) session with `signOut()` in the default **global** scope, revoking every session of the user on every device through an unauthenticated GET. Change it to local scope, move the logic into an injectable `lib/auth` unit (mirroring `createLogout`), stop logging raw error objects, and cover it with unit tests (>= 80 %, `lib/auth/**` >= 90 %) and a deterministic two-context E2E.

## Current State Analysis

- `app/api/auth/session-expired/route.ts:8-22` calls `supabase.auth.signOut()` (global) and logs the raw error in `catch`. Provider failures are *returned* as `{ error }`, not thrown, so they are silently dropped today.
- `lib/auth/logout.ts` + `lib/auth/sign-out.ts` already show the target pattern: injected `createClient`/`log`, `scope: "local"`, safe `{ code, status }` logging via `logAuthEvent`. `extractMeta` (code/status narrowing) lives privately in `sign-out.ts:15-22`.
- `lib/auth/messages.ts` owns log-event constants (`LOGOUT_LOG_EVENT`).
- Proxy cookie cleanup (`proxy.ts:87-93`) and this route are mutually exclusive (provider expiry vs app expiry) — no removal needed.
- `vitest.config.ts` enforces 80 % global and 90 % on `lib/auth/**`.

## Desired End State

- Expired-session cleanup ends only the current session; a second session of the same user stays valid (verified in E2E).
- Redirect (`307`, `/login?next=<sanitised>`) and `Cache-Control` unchanged.
- Failures are logged with `code`/`status` only via `logAuthEvent`; the user always reaches `/login`.
- `npm run test:run` passes with coverage thresholds met; E2E spec passes in CI.

### Key Discoveries:

- Only trigger: `lib/auth/require-session.ts:39-45` (valid session, app-expired) — the JWT is still valid, so global scope really revokes all devices.
- `signOut()` returns `{ error }` for provider errors (`GoTrueClient.js:3405-3443`); cookies are still cleared locally except on a session-read error.
- Route is public (`/api/auth` prefix), so E2E can call it directly without waiting for expiry.
- Local Chromium is unsupported on this macOS (see `log-out-of-the-app/plan-brief.md`); E2E runs in CI.

## What We're NOT Doing

- Changing logout behaviour, its messages, or its post-error `getClaims()` re-check.
- Changing the route to POST or verifying expiry server-side (backlog note).
- Deleting `session_extensions`, session-extension handling, redirect shape, or `loggedOut=1`.
- Fixing `lib/session/service.ts:56` / `app/actions/session.ts:23` raw-error logs (follow-up: **Harden remaining auth/session error logging**).
- UI, Tailwind or a11y work: this change has no rendered UI, so those requirements are N/A. The existing `role="status"`/dialog markup is untouched.

## Implementation Approach

Single Responsibility / Dependency Inversion: the Route Handler only parses the request, calls an injected cleanup function, and builds the redirect. The cleanup unit owns "sign out locally, never throw, log safely". Shared error-to-log-details mapping is promoted from `sign-out.ts` to a new `lib/auth/error-details.ts` (DRY) and reused. It is deliberately not placed in `log.ts`: `__tests__/api/auth/logout.test.ts` mocks `@/lib/auth/log` with `logAuthEvent` only, so a helper there would be undefined for `sign-out.ts` under that mock. Structure follows the Next.js App Router convention already in the repo: thin handler in `app/api/...`, logic in `lib/auth`, unit tests in `__tests__/` mirroring paths, E2E in `e2e/`.

## Critical Implementation Details

- **Never throw from cleanup**: `signOut` may reject or return `{ error }`, and `createClient` may throw `SupabaseConfigError`. All three paths must log and resolve so the redirect to `/login` always happens.
- **Do not reuse `signOutCurrentSession`**: its `getClaims()` re-check adds a network call per expiry redirect that nothing consumes.

## Phase 1: Shared safe-logging helper and event constants

### Overview

Introduce the reusable pieces first so Phase 2 has no duplication.

### Changes Required:

#### 1. Promote error-meta extraction

**File**: `lib/auth/error-details.ts` (new); `lib/auth/log.ts` (updated)

**Intent**: Export the existing code/status narrowing from a standalone module so any caller can turn an unknown error into safe log details without depending on the logger module (which tests mock).

**Contract**: `export type AuthLogDetails = { code?: string; status?: number }`; `export function describeAuthError(error: unknown): AuthLogDetails` — returns only string `code` and numeric `status`, `{}` otherwise. `logAuthEvent` imports `AuthLogDetails` (type-only) for its `details` parameter; its runtime behaviour is unchanged.

#### 2. Reuse it in sign-out

**File**: `lib/auth/sign-out.ts`

**Intent**: Replace the private `extractMeta` with `describeAuthError` from `lib/auth/error-details.ts` (import swap, no behaviour change).

**Contract**: `SignOutResult` shape unchanged; existing `sign-out.test.ts` and `__tests__/api/auth/logout.test.ts` (which mocks `@/lib/auth/log`) must pass untouched.

#### 3. Event constants

**File**: `lib/auth/messages.ts`

**Intent**: Add distinguishable log events for automatic expiry cleanup.

**Contract**: `export const EXPIRED_SESSION_LOG_EVENT = { providerError, configuration, unexpected } as const` with values `auth.expired_session.provider_error | .configuration_error | .unexpected_error`.

#### 4. Tests

**File**: `__tests__/lib/auth/error-details.test.ts`, `__tests__/lib/auth/log.test.ts`

**Intent**: Table-driven tests for `describeAuthError` (string code, numeric status, wrong types, null, non-object, `Error` instance) and for `logAuthEvent` (details default `{}`).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:run`
- Existing sign-out and logout tests still pass unchanged: `npx vitest run __tests__/lib/auth/sign-out.test.ts __tests__/api/auth/logout.test.ts`
- Lint passes: `npm run lint`
- Type check passes: `npx tsc --noEmit`

**Implementation Note**: Pause after automated verification before Phase 2.

---

## Phase 2: Injectable cleanup unit and route

### Overview

Add the local-scope cleanup, wire it into the route, and cover every branch.

### Changes Required:

#### 1. Cleanup unit

**File**: `lib/auth/expired-session.ts`

**Intent**: Create `createExpiredSessionCleanup(deps)` mirroring `createLogout`: signs out the current session only and reports failures through the injected logger.

**Contract**:
```ts
type ExpiredSessionDependencies = {
  createClient: () => Promise<{ auth: Pick<SupabaseClient["auth"], "signOut"> }>;
  log: (event: string, details?: AuthLogDetails) => void;
};
export function createExpiredSessionCleanup(deps): () => Promise<void>;
```
Behaviour: `signOut({ scope: "local" })` called exactly once; returned `{ error }` → `log(providerError, describeAuthError(error))`; `SupabaseConfigError` → `log(configuration, { code: error.reason })`; any other throw → `log(unexpected)` with no details. Never rejects. A named constant (e.g. `LOCAL_SCOPE`) holds the scope option so there is no inline magic value.

#### 2. Route

**File**: `app/api/auth/session-expired/route.ts`

**Intent**: Compose the cleanup at module level (like `app/api/auth/logout/route.ts`) and keep only request parsing and redirect building in `GET`. Add a short comment: app-level expiry on a valid session, distinct from the provider-expiry cookie cleanup in `proxy.ts`.

**Contract**: `GET(request): Promise<Response>` unchanged externally — `307` to `/login?next=<resolvePostLoginPath(next)>` with `Cache-Control: AUTH_REDIRECT_CACHE_CONTROL`. Wiring: `createClient: createServerSupabaseClient`, `log: logAuthEvent`.

#### 3. Unit tests for the unit

**File**: `__tests__/lib/auth/expired-session.test.ts`

**Intent**: Cover every branch with injected fakes (no module mocking).

**Contract** (cases): signs out once with `{ scope: "local" }`; success logs nothing; returned `{ error: { code, status } }` logs provider event with code/status only; error with extra fields (message, stack) does not leak them; `signOut` rejects → unexpected event, no details; `createClient` throws `SupabaseConfigError` → configuration event with `reason`; resolves (never rejects) in all failure cases.

#### 4. Route tests

**File**: `__tests__/api/auth/session-expired.test.ts`

**Intent**: Keep the route contract tests; rename the misleading title; assert `toHaveBeenCalledWith({ scope: "local" })` and `toHaveBeenCalledTimes(1)`; add a failure case proving the redirect and cache header still happen when `signOut` returns an error or the client factory throws, and that `console.error` receives no `Error` instance.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:run`
- Coverage thresholds met (>= 80 % global, >= 90 % `lib/auth/**`): `npm run test:coverage`
- `expired-session.ts` and `error-details.ts` show 100 % statements/branches in the coverage report
- Lint passes: `npm run lint`
- Type check passes: `npx tsc --noEmit`
- Regression guard proven: temporarily reverting to `signOut()` makes the route and cleanup tests fail

#### Manual Verification:

- Reading the route shows no sign-out or logging logic, only parse, delegate, redirect

**Implementation Note**: Pause for confirmation before Phase 3.

---

## Phase 3: E2E isolation test, shared helpers, docs

### Overview

Prove at the server that the second session survives, remove duplicated E2E helpers, and document the boundary.

### Changes Required:

#### 1. Shared E2E helpers

**File**: `e2e/helpers/auth-session.ts` (new); `e2e/logout.spec.ts`, `e2e/session-expiry.spec.ts` (updated)

**Intent**: Extract `signUp`, a "log in a second context" helper, `authCookieCount` and `decodeAuthCookie` (currently private to `session-expiry.spec.ts:21`, needed to read B's access token) so the specs share them (DRY); `logout.spec.ts` and `session-expiry.spec.ts` import them with no behaviour change.

**Contract**: `signUpNewUser(browser, label)` → `{ email, context, page }`; `logInInNewContext(browser, email)` → `{ context, page }`; `authCookieCount(page)`; `decodeAuthCookie(cookies, storageKey)`. Constants (`BASE_URL`, `password`, viewport) exported once.

#### 2. New spec

**File**: `e2e/session-expired-route.spec.ts`

**Intent**: Direct route call from context A; assert redirect contract and that context B (same user) is still valid.

**Contract** (tests):
- Redirect: `A.request.get("/api/auth/session-expired?next=%2Fdashboard%3Ftab%3Drecent", { maxRedirects: 0 })` → `307`, `location` ends `/login?next=%2Fdashboard%3Ftab%3Drecent`, `cache-control: private, no-store, max-age=0`; A's auth cookies reach 0 (use `isAuthSessionCookie`).
- Isolation (time-sensitive: Playwright runs with a 30 s application lifetime, so sign up A, log in B, call the route and run these checks back to back; do not add waits; assert the token check **first** because it is independent of app expiry, then `reload()`): B's access token (via `decodeAuthCookie`) still returns `200` from `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, sent with both `apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY` and `Authorization: Bearer <token>` headers (server-side check; `403/401` under the old global scope). Then B `reload()` stays on `/dashboard`.
- External `next` is rejected → `/login?next=%2Fdashboard`.

#### 3. Docs

**File**: `docs/route-guard.md`

**Intent**: Add one sentence after "Logging out": expired-session cleanup (`/api/auth/session-expired`) also uses local scope and leaves other devices signed in; it is distinct from the proxy's provider-expiry cookie cleanup.

### Success Criteria:

#### Automated Verification:

- Existing logout E2E unaffected: `npm run test:e2e -- e2e/logout.spec.ts` (CI)
- New spec passes: `npm run test:e2e -- e2e/session-expired-route.spec.ts` (CI)
- New spec fails against the unfixed global-scope route (isolation assertion), then passes after the fix: on the PR branch push a throwaway commit that temporarily makes the cleanup call `signOut()` (global), confirm the CI isolation test fails, then drop the commit (`git reset`/revert) and confirm CI is green
- Lint and type check pass: `npm run lint`, `npx tsc --noEmit`
- Full unit run with coverage passes: `npm run test:coverage`

#### Manual Verification:

- If E2E cannot run locally, the CI run is green on the PR
- `docs/route-guard.md` reads correctly and makes no claim that expiry signs out everywhere

---

## Testing Strategy

### Unit Tests:

- `describeAuthError`, `logAuthEvent`; `createExpiredSessionCleanup` (every branch); route contract incl. failure cases.
- Edge cases: error object with extra fields, wrong-typed code/status, rejected promise, config error, external `next`.

### Integration Tests:

- `e2e/session-expired-route.spec.ts` (two contexts, one user), existing `e2e/session-expiry.spec.ts` unchanged.

### Manual Testing Steps:

1. Log in on two browsers; open `/api/auth/session-expired` in one; confirm it lands on `/login` and the other still loads `/dashboard`.

## Performance Considerations

None: one `signOut` call as before; no added network call.

## Migration Notes

None. No data or schema changes; backward compatible.

## References

- Related research: `context/changes/fix-expired-session-local-sign-out/research.md`
- Pattern: `lib/auth/logout.ts`, `lib/auth/sign-out.ts`, `app/api/auth/logout/route.ts`
- Two-context E2E pattern: `e2e/logout.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared safe-logging helper and event constants

#### Automated

- [ ] 1.1 Unit tests pass
- [ ] 1.2 Existing sign-out and logout tests still pass unchanged
- [ ] 1.3 Lint passes
- [ ] 1.4 Type check passes

### Phase 2: Injectable cleanup unit and route

#### Automated

- [ ] 2.1 Unit tests pass
- [ ] 2.2 Coverage thresholds met (>= 80 % global, >= 90 % lib/auth)
- [ ] 2.3 New lib/auth files at 100 % statements and branches
- [ ] 2.4 Lint passes
- [ ] 2.5 Type check passes
- [ ] 2.6 Regression guard proven by reverting to global signOut

#### Manual

- [ ] 2.7 Route contains only parse, delegate, redirect

### Phase 3: E2E isolation test, shared helpers, docs

#### Automated

- [ ] 3.1 Existing logout E2E unaffected
- [ ] 3.2 New E2E spec passes
- [ ] 3.3 New E2E isolation assertion fails against the unfixed route
- [ ] 3.4 Lint and type check pass
- [ ] 3.5 Full unit run with coverage passes

#### Manual

- [ ] 3.6 CI E2E green if not runnable locally
- [ ] 3.7 docs/route-guard.md reads correctly
