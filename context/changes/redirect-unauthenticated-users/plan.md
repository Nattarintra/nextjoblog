# Redirect Unauthenticated Users from Protected Pages — Implementation Plan

## Overview

Story 0.4 (GitHub issue #6). Logged-out users who open a protected URL are redirected to `/login?next=<requested path + query>`; after a successful login they return to that page. `next` is validated as an internal relative path in two places (login page render and the `login()` Server Action) and falls back to `/dashboard` for anything external or auth-related. The guard fails closed: a failed session check renders the "We couldn't verify your session" screen with retry (no sign-out, no data), and a missing or non-owned record renders a generic not-found page.

## Current State Analysis

- Only `app/dashboard/page.tsx:10-19` guards itself, inline; both "no session" and "session expired" go to `/api/auth/session-expired`, which signs out and redirects to a bare `/login` — the requested URL is lost (`app/api/auth/session-expired/route.ts:5-14`).
- `lib/session/service.ts:22-24` returns `undefined` for any `getClaims()` error, so "Supabase unreachable" is indistinguishable from "no session" and currently ends in a **sign-out**. A `lookup_error` is `throw`n and there is no `error.tsx`/`not-found.tsx` anywhere in `app/`.
- `login()` hard-codes `redirect("/dashboard")` (`app/actions/auth.ts:200`); the login page takes no props and the form has no `next` field.
- `proxy.ts:15-79` refreshes cookies via `getClaims()` but never redirects, and fails open on `SupabaseConfigError` (`:21-35`). It and `lib/supabase/server.ts` are excluded from the coverage gate (`vitest.config.mts:12`).
- RLS (`auth.uid() = user_id`) is already on every table (`supabase/migrations/20260902082511_create_rls_policies.sql`; `supabase/docs/Nextjoblog-supabase-schema.md` §3). No record routes (`/applications/[id]`) exist.
- Shared auth UI (`AuthLogo`, `styles.ts`) lives under `app/signup/` but is imported by login.
- Baseline: 16 test files / 113 tests, 93.8% statements, 89.4% branches; `app/actions/auth.ts` is the weakest file (81% lines / 68.6% branches) and this plan adds branches to it.

## Desired End State

- `GET /dashboard` (and any non-public path, including `/`) while logged out answers **307** to `/login?next=%2Fdashboard` with `Cache-Control: private, no-store, max-age=0`; no protected markup is ever sent.
- After login, the user lands on the requested path with its query intact; external, protocol-relative, backslash, oversize or auth-path `next` values land on `/dashboard`.
- A session-verification failure (network/service/config/thrown) on a protected page renders screen 00.6; **Try Again** re-runs the server check for the same URL; the session is never destroyed and no application data is queried.
- Zero rows for a record (deleted or not owned) → `notFound()` → screen 00.7 (generic copy, "Go to Dashboard" only).
- `npm run test:run` passes with coverage ≥ 80% globally and ≥ 90% for `lib/auth/**`; the Playwright suite covers every acceptance criterion on GitHub Actions (Linux Chromium is the authoritative runner).

### Key Discoveries:

- Next 16 guidance (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`): Proxy is an optimistic cookie-only pre-filter; the authoritative check belongs in a DAL near the data; layouts don't re-render on navigation so must not be the only guard.
- `getClaims()` (auth-js 2.113.0) returns `{data:null,error:null}` with no stored session, an `AuthInvalidJwtError` for a bad/expired JWT, a retryable fetch error on network failure, and can throw a non-`AuthError` from `fetchJwk` — three outcomes, not two.
- `redirect()` throws `NEXT_REDIRECT`, so in `login()` the target must be computed before the `try` and `redirect(target)` called after it (existing convention, `app/actions/auth.ts:200`).
- `setAll` in `proxy.ts:42-56` replaces `response`; a naïve `NextResponse.redirect` would drop refreshed/cleared auth cookies.
- Route groups don't affect URLs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`); two groups must not resolve to the same path.

## What We're NOT Doing

- `next` after **signup** (signup keeps `redirect("/dashboard")`); a future story.
- Role/permission tiers; preserving unsaved form input across the redirect.
- A real `/applications` list or `/applications/[id]` page (Feature 1). The "View All Applications" button on 00.7 is omitted until that route exists.
- `/forgot-password` and `/reset-password` pages themselves — only their paths are registered in the auth-path data so they're covered when built.
- Redirecting already-authenticated users away from `/login`.
- Using the experimental `unauthorized()` / `forbidden()` APIs.
- Changing the proxy's fail-open on `SupabaseConfigError` (changing it risks a redirect loop because `/login` also needs config); the DAL is the closed gate instead.

## Implementation Approach

Two enforcement layers sharing one set of pure functions, so they cannot disagree about `next`:

1. **Proxy (optimistic, fast, no flash):** classifies the `getClaims()` result and calls pure `decideRouteAccess`. Redirects **only** on a definite "unauthenticated" for a non-public path (default-deny). Never redirects on verification failure (otherwise outage = login loop).
2. **DAL `requireSession()` (authoritative):** called at the top of every protected page. Uses the full `getEffectiveSessionExpiry` (claims + `session_extensions`), redirects on unauthenticated/expired, and returns a `verification_failed` result that the page renders as screen 00.6.

All decision logic lives in small pure modules under `lib/auth/` with injected dependencies (SOLID: S — validator/classifier/decision/DAL/UI separate; O — new public routes, auth prefixes and destination labels are data edits, new protected routes need no guard edits; D — DAL takes `getSessionState`, `redirect`, `getRequestPath` as parameters). Delivery order puts pure, fully-testable code first; wiring last.

Target structure (Next.js project-structure conventions: colocate route-specific UI, share reusable UI in `components/`, domain logic in `lib/`, route groups for organisation, `_private` folders for non-routable colocated files):

```
app/
  page.tsx                      → redirect("/dashboard")
  not-found.tsx                 → screen 00.7 (generic)
  login/…                       → reads searchParams.next
  (protected)/
    layout.tsx                  → presentational: SessionExpiryNotice only (no auth logic)
    _components/                → SessionExpiryNotice*, hooks (moved from app/dashboard)
    dashboard/page.tsx          → await requireSession()
    session-check-failed/…      → (component only) SessionCheckFailed client UI
components/auth/                → AuthLogo, styles (promoted from app/signup)
lib/auth/                       → paths, next-path, login-redirect, describe-destination,
                                  route-access, session-state, require-session,
                                  request-path, test-hooks, not-found-if-missing,
                                  redirect-response
```

## Critical Implementation Details

- **Original URL reaches the DAL via a proxy-set request header.** Server Components can't read the pathname. `proxy.ts` sets a request header (e.g. `x-request-path` = pathname + search, always overwritten so a client-supplied value can't survive) following the "Setting headers" section of `proxy.md`; `lib/auth/request-path.ts` is the only reader. Whatever it yields is still passed through `resolvePostLoginPath` before use; a missing header degrades to a `next`-less `/login` redirect.
- **Cookie preservation on the proxy redirect.** The redirect response must carry every cookie set or deleted on the working `response` (refreshed tokens, `session_expired` cleanup at `proxy.ts:67-72`) plus `Cache-Control: private, no-store, max-age=0`. Extract this as `lib/auth/redirect-response.ts` so it is unit-tested; `proxy.ts` stays wiring.
- **Test seam must be unreachable in production.** The `e2e-session-check=fail` cookie is honoured only when `NODE_ENV !== "production"` **and** `E2E_TEST_HOOKS === "1"`; the only place that sets the env var is the Playwright `webServer.command`. A unit test must prove the seam is inert when either condition is false.

---

## Phase 1: Pure auth-redirect core

### Overview

Everything that decides *where to send the user* as pure, table-tested functions with no framework imports (except type-only). This is the open-redirect defence and the default-deny rule.

### Changes Required:

#### 1. Constants

**File**: `lib/auth/paths.ts`

**Intent**: Single home for every route/limit constant so call sites contain no magic strings or numbers.

**Contract**: exports `LOGIN_PATH="/login"`, `DEFAULT_POST_LOGIN_PATH="/dashboard"`, `NEXT_PARAM_NAME="next"`, `MAX_NEXT_LENGTH=2048`, `AUTH_PATH_PREFIXES` (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/api/auth`), `PUBLIC_PATH_PREFIXES` (the auth prefixes only — `/` is protected), `SESSION_EXPIRED_PATH="/api/auth/session-expired"`, `AUTH_REDIRECT_CACHE_CONTROL="private, no-store, max-age=0"`. Prefix matching is on a path-segment boundary.

#### 2. `next` sanitizer

**File**: `lib/auth/next-path.ts`

**Intent**: The sole open-redirect defence. Accept only a single internal relative path; otherwise return the default.

**Contract**: `resolvePostLoginPath(raw: unknown): string` — returns `pathname + search` (hash dropped). Rejects (→ `/dashboard`): non-strings/arrays, empty, longer than `MAX_NEXT_LENGTH`, not starting with exactly one `/`, any `\`, control/whitespace characters (also after one percent-decode, e.g. `%5C`, `%0A`), values whose `new URL(raw, "http://internal.invalid")` origin differs from the sentinel, and paths whose normalised, lower-cased, decoded pathname matches an auth prefix. Query string is preserved verbatim.

#### 3. Login URL builders

**File**: `lib/auth/login-redirect.ts`

**Intent**: One place that builds the two redirect URLs so proxy and DAL agree.

**Contract**: `buildLoginRedirectUrl(requestedPath: string): string` → `/login?next=` + `encodeURIComponent(resolvePostLoginPath(requestedPath))`; `buildSessionExpiredUrl(requestedPath: string): string` → `/api/auth/session-expired?next=…` (same encoding).

#### 4. Destination label

**File**: `lib/auth/describe-destination.ts`

**Intent**: Human label for the 00.5 return strip so the raw URL is never echoed. Open for extension via a route→label table.

**Contract**: `describeDestination(safePath: string): string | undefined` using an ordered `DESTINATION_LABELS` table (`/dashboard` → "Your dashboard", `/applications/:id` → "An application"); unknown → `undefined` (no strip).

#### 5. Route-access decision

**File**: `lib/auth/route-access.ts`

**Intent**: Public-vs-protected default-deny decision extracted from `proxy.ts` so it is unit-tested.

**Contract**:
```ts
type AuthState = "authenticated" | "unauthenticated" | "verification_failed";
type RouteDecision = { action: "allow" } | { action: "redirect"; location: string };
decideRouteAccess(input: { pathname: string; search: string; authState: AuthState }): RouteDecision
```
Public path → allow; protected + authenticated → allow; protected + `verification_failed` → **allow** (DAL renders 00.6); protected + unauthenticated → redirect to `buildLoginRedirectUrl(pathname + search)`.

#### 6. Claims classifier

**File**: `lib/auth/session-state.ts`

**Intent**: Replace the `undefined` collapse with an explicit three-way classification of a `getClaims()` result.

**Contract**: `classifyClaimsResult(result: { data: {claims}|null; error: unknown }): ClaimsState` where `ClaimsState = {kind:"authenticated"; claims} | {kind:"unauthenticated"; reason:"missing"|"invalid"|"expired"} | {kind:"verification_failed"}`. `error == null && data == null`, `AuthSessionMissingError`, `AuthInvalidJwtError`, `session_expired` → unauthenticated; retryable fetch error, `status === 0`/5xx `AuthError`, any unknown error → verification_failed. Plus `classifyThrown(error: unknown): ClaimsState` → always `verification_failed`. Error predicates imported from `@supabase/auth-js` (`isAuthSessionMissingError`, `isAuthRetryableFetchError`, `isAuthApiError`); `AuthInvalidJwtError` has no predicate in 2.113.0, so use `instanceof AuthInvalidJwtError`.

### Success Criteria:

#### Automated Verification:

- New unit tests pass: `npx vitest run __tests__/lib/auth`
- `resolvePostLoginPath` table covers every story/NFR case (valid, query-intact, `//evil.com`, `https://evil.com`, `/\evil.com`, `/%5Cevil.com`, `javascript:`, CR/LF, empty, array, oversize, `/login`, `/login/x`, `/LOGIN`, `/loginfoo` allowed, `/reset-password`, `/api/auth/x`)
- Coverage for `lib/auth/**` ≥ 90%: `npm run test:coverage`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Code review: no magic strings/numbers outside `paths.ts`; no framework imports in the pure modules.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Promote shared auth UI

### Overview

Behavior-preserving refactor so login, signup and the new screens depend on a neutral shared location, not on `app/signup/`.

### Changes Required:

#### 1. Move shared pieces

**File**: `app/signup/AuthLogo.tsx`, `app/signup/styles.ts` → `components/auth/AuthLogo.tsx`, `components/auth/styles.ts`

**Intent**: Neutral shared home (Next.js "shared components" convention). Signup-specific components (`PasswordField`, `SignupAlerts`, …) stay co-located.

**Contract**: exports unchanged (`AuthLogo`, `authInputClassName`, `authFieldLabelClassName`, `authLinkClassName`). Update every import (`app/login/LoginForm.tsx`, `app/login/LoginFields.tsx`, `app/signup/*`) and any `vi.mock` paths in `__tests__/login`, `__tests__/signup`. No re-export shim left behind.

### Success Criteria:

#### Automated Verification:

- All existing tests still pass unchanged in assertions: `npm run test:run`
- No stale imports: `grep -rn "app/signup/\(AuthLogo\|styles\)" app __tests__` returns nothing
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- `/login` and `/signup` render identically to before (logo, inputs, links).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Login honours `next`

### Overview

The login page reads and sanitizes `next`, shows the 00.5 return strip, carries it in a hidden field, and `login()` re-validates (the action is the trust boundary).

### Changes Required:

#### 1. Login page

**File**: `app/login/page.tsx`

**Intent**: Become `async`, await `searchParams` (a Promise in Next 16; see `page.md:67-83`), compute `nextPath = resolvePostLoginPath(next)` and `destinationLabel = describeDestination(nextPath)`, pass both to `LoginForm`.

**Contract**: `PageProps<"/login">`; props to form: `{ nextPath: string; destinationLabel?: string }`.

#### 2. Login form and fields

**File**: `app/login/LoginForm.tsx`, `app/login/LoginFields.tsx`, new `app/login/ReturnStrip.tsx`

**Intent**: Render the hidden `<input type="hidden" name="next">`; when `destinationLabel` exists, switch heading to "Log In to Continue", subtitle "You need to be logged in to open this page.", and show `ReturnStrip` ("You'll return to the page you opened" + label). Without `next`/label the page is unchanged.

**Contract**: `ReturnStrip` is presentational (`{ label: string }`), uses semantic markup (`<aside aria-label>` or `role="note"`), decorative icon `aria-hidden`, text colours from existing tokens with ≥ 4.5:1 contrast on navy.

#### 3. Server Action

**File**: `app/actions/auth.ts`

**Intent**: `login()` computes `const redirectTarget = resolvePostLoginPath(formData.get("next"))` before the `try`, and calls `redirect(redirectTarget)` after it. `signup()` is untouched.

**Contract**: no new `LoginFormState` variants.

### Success Criteria:

#### Automated Verification:

- `login()` tests: valid internal `next` → `redirect` called with it (incl. query); each malicious/auth/missing value → `redirect("/dashboard")`; failed login never redirects: `npx vitest run __tests__/actions/auth.test.ts`
- Login page/form tests: hidden field value, return strip shown only when a label exists, no raw URL in DOM, heading variants: `npx vitest run __tests__/login`
- Coverage thresholds hold (incl. `app/actions/auth.ts` ≥ 80% branches): `npm run test:coverage`
- Type checking and lint pass: `npx tsc --noEmit && npm run lint`

#### Manual Verification:

- Visiting `/login?next=/dashboard` shows the return strip; `/login?next=https://evil.com` shows the plain login page.
- Keyboard: Tab order is strip-agnostic (strip is not focusable); focus rings visible.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Session classification and DAL

### Overview

Make the session lookup fail-closed with three explicit states, add `requireSession()`, and stop the expired-session handler from dropping `next`.

### Changes Required:

#### 1. Effective-session lookup

**File**: `lib/session/service.ts` (+ `lib/session.ts` barrel)

**Intent**: Replace the `undefined` return and the `lookup_error` branch with the classifier output. `getClaims()` classification via `classifyClaimsResult`; a thrown error or `session_extensions` lookup failure (including `SupabaseConfigError`) → `verification_failed`; missing/invalid `amr`/`session_id` claims → `unauthenticated`/`invalid`.

**Contract**: `EffectiveSessionExpiry = {status:"authenticated"; claims; effectiveExpiresAt} | {status:"unauthenticated"; reason} | {status:"verification_failed"; error?: unknown}` (the old `lookup_error` is folded into `verification_failed`). Update every consumer found via `grep -rn getEffectiveSessionExpiry` (dashboard layout/page, session action, tests). `cache()` memoisation retained.

#### 2. Test seam

**File**: `lib/auth/test-hooks.ts`

**Intent**: Deterministically force `verification_failed` in E2E (and let retry succeed by clearing the cookie).

**Contract**: `applyTestSessionOverride(state, { env, cookieValue })` — pure; returns `{status:"verification_failed"}` only when `env.NODE_ENV !== "production"`, `env.E2E_TEST_HOOKS === "1"`, and `cookieValue === "fail"`; otherwise returns `state` unchanged. Cookie name exported as `TEST_SESSION_CHECK_COOKIE = "e2e-session-check"`.

#### 3. Request-path adapter

**File**: `lib/auth/request-path.ts`

**Intent**: The single reader of the proxy-set header, isolated so the DAL stays injectable.

**Contract**: `REQUEST_PATH_HEADER` constant; `getRequestPath(): Promise<string | undefined>` reading `headers()` from `next/headers`.

#### 4. DAL

**File**: `lib/auth/require-session.ts`

**Intent**: One entry point for every protected page. Authenticated and not expired → returns the session; unauthenticated or expired → redirect; verification failure → returns a `verification_failed` result (page renders 00.6) and never signs out or queries data.

**Contract**:
```ts
createRequireSession(deps: {
  getSessionState: () => Promise<EffectiveSessionExpiry>;
  getRequestPath: () => Promise<string | undefined>;
  redirect: (url: string) => never;
  now?: () => number;
}): () => Promise<
  | { status: "authenticated"; claims: JwtPayload; effectiveExpiresAt: number }
  | { status: "verification_failed"; loginHref: string }
>
export const requireSession = cache(createRequireSession(defaultDeps));
```
Unauthenticated → `redirect(buildLoginRedirectUrl(path))`; authenticated but `isSessionExpired` → `redirect(buildSessionExpiredUrl(path))` (cookie cleanup stays in a response context). Default `getSessionState` wraps `getEffectiveSessionExpiry` with `applyTestSessionOverride` reading the cookie.

#### 5. Expired-session handler

**File**: `app/api/auth/session-expired/route.ts`

**Intent**: Keep sign-out, but forward a sanitized `next` so users returning after the 30-day timebox still land on their deep link.

**Contract**: reads `next` from the request URL, redirects to `buildLoginRedirectUrl(resolvePostLoginPath(next))`; response carries `Cache-Control: private, no-store, max-age=0`.

### Success Criteria:

#### Automated Verification:

- Classifier + service tests: network error, thrown error, config error, no session, invalid JWT, expired → correct state; none of the failure paths calls `signOut`: `npx vitest run __tests__/lib`
- DAL tests with injected deps: all four branches + loginHref + missing request path: `npx vitest run __tests__/lib/auth`
- Seam tests: inert unless both env conditions and cookie hold
- `session-expired` route test: forwards sanitized `next`, rejects `https://evil.com`, sets `Cache-Control`: `npx vitest run __tests__/api`
- Coverage ≥ 80% global / ≥ 90% `lib/auth/**`: `npm run test:coverage`
- Type checking and lint pass: `npx tsc --noEmit && npm run lint`

#### Manual Verification:

- With Supabase stopped, an authenticated user's session cookies are **not** cleared after hitting a protected page (inspect in devtools).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Protected route group and screens

### Overview

Adopt the `(protected)` route group, make `/dashboard` canonical (`/` redirects to it), and build screens 00.6 and 00.7 plus the fetch-or-404 helper.

### Changes Required:

#### 1. Route group migration

**File**: `app/dashboard/*` → `app/(protected)/dashboard/page.tsx`, `app/(protected)/layout.tsx`, `app/(protected)/_components/*`

**Intent**: Move the dashboard under the group so future protected routes share structure. The group layout stays presentational: it calls `getEffectiveSessionExpiry()` directly (as `app/dashboard/layout.tsx` does today, never `requireSession()`, which redirects) and renders `SessionExpiryNotice` only when `status === "authenticated"`; **auth is enforced in each page via `requireSession()`**, not in the layout. Because opt-in guards can be forgotten, add a vitest (`__tests__/protected-pages-guard.test.ts`) that globs `app/(protected)/**/page.tsx` and fails if a page doesn't reference `requireSession`. Move `SessionExpiryNotice*`, `useDialogKeyboardNavigation`, `useSessionExpiryNotice`, `useSessionExtension`, `session-expiry-notice.ts` to `_components/`. Update imports in `__tests__/dashboard/*`.

**Contract**: URLs unchanged (`/dashboard`). The page: `const session = await requireSession(); if (session.status === "verification_failed") return <SessionCheckFailed loginHref={session.loginHref} />;` then the existing dashboard markup. Layout is typed `LayoutProps<"/">` (the group layout wraps the root segment; confirm against the generated `.next/types` after `next typegen`/build and adjust the generic if the generator names it differently).

#### 2. Home redirect

**File**: `app/page.tsx`

**Intent**: Replace the "under construction" placeholder with `redirect("/dashboard")`. Unauthenticated users never reach it (proxy default-deny sends them to `/login?next=%2F`).

**Contract**: after login, `next=/` resolves to `/` → this page → `/dashboard`.

#### 3. Screen 00.6

**File**: `app/(protected)/_components/SessionCheckFailed.tsx` (client)

**Intent**: Wireframe `supabase/docs/nextjoblog-mvp-screens.html:540-562`: shield icon, "We Couldn't Verify Your Session", explanation, 3 numbered steps, **Try Again** (calls `router.refresh()` inside `useTransition`), **Go to Log In** (`<Link href={loginHref}>`), footnote "No application data was loaded".

**Contract**: props `{ loginHref: string }`. A11y: heading is `h1` and receives focus on mount (`tabIndex={-1}`); steps are an `<ol>` (no manual digit spans); Try Again is a real `<button type="button">` with `aria-busy` + "Checking…" label while pending and a polite live region announcing "Still unable to verify your session" after a failed retry; visible focus rings; warn colours reuse `--warning-*`/new tokens added to `app/globals.css` with ≥ 4.5:1 contrast.

#### 4. Screen 00.7 and helper

**File**: `app/not-found.tsx`, `lib/auth/not-found-if-missing.ts`

**Intent**: Generic not-found page ("We can't find this page — it may have been deleted, or the link may be wrong.", **Go to Dashboard** link, no "View All Applications" until `/applications` exists). Helper encodes the security pattern for future record pages: zero rows from the user-scoped client (`.maybeSingle()`) ⇒ `notFound()`, never a distinct "forbidden", so existence of another user's row is not leaked.

**Contract**: `notFoundIfMissing<T>(row: T | null | undefined, notFound: () => never): T` (the `notFound` function injected for testability). Document the pattern and the public-path / DAL / seam conventions in `docs/route-guard.md` (≤ 1 page).

### Success Criteria:

#### Automated Verification:

- Dashboard page tests: authenticated renders dashboard; `verification_failed` renders 00.6 and does not render dashboard; redirects delegated to DAL; guard-coverage test (every `app/(protected)/**/page.tsx` references `requireSession`): `npx vitest run __tests__/dashboard __tests__/protected-pages-guard.test.ts`
- `SessionCheckFailed` tests: heading focused, `<ol>` with 3 items, Try Again calls `router.refresh`, pending state, login link href, no data text: `npx vitest run __tests__/session`
- `not-found` + `notFoundIfMissing` tests (null/undefined → throws via injected fn; row → returned)
- `app/page.tsx` redirect test
- Full suite + coverage gate: `npm run test:coverage`
- Production build succeeds: `npm run build`
- Type checking and lint pass: `npx tsc --noEmit && npm run lint`

#### Manual Verification:

- `/` and `/dashboard` while logged in both end at `/dashboard`.
- Screens 00.6 and 00.7 visually match the wireframe on a phone-width viewport; Try Again and Go to Dashboard are reachable by keyboard only; screen reader announces the heading.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Proxy wiring and E2E

### Overview

Turn on the optimistic redirect in `proxy.ts` (thin wiring over Phase 1 functions), then prove every acceptance criterion end to end.

### Changes Required:

#### 1. Redirect response helper

**File**: `lib/auth/redirect-response.ts`

**Intent**: Build the 307 redirect while carrying over cookies from the working response and adding the no-store header.

**Contract**: `createAuthRedirect(location: string, requestUrl: string, source: NextResponse): NextResponse` — copies every cookie (set and deleted) from `source`, sets `Cache-Control: AUTH_REDIRECT_CACHE_CONTROL`, status 307. Unit-tested (use `// @vitest-environment node` if jsdom lacks the needed globals).

#### 2. Proxy

**File**: `proxy.ts`

**Intent**: After `getClaims()`, classify (`classifyClaimsResult` / `classifyThrown`), set the request-path header, call `decideRouteAccess`, and return either the working `response` or `createAuthRedirect(...)`. Keep the config-error fail-open branch and the `session_expired` cookie-clearing exactly as is. `config.matcher` unchanged.

**Contract**: header `REQUEST_PATH_HEADER` is always overwritten with `pathname + search` on forwarded requests. It must survive the `setAll` response rebuild (`proxy.ts:46`, fires on token refresh): set it on `request.headers` before the first `NextResponse.next({ request })` (or build forwarded headers once and pass `{ request: { headers } }` at both construction sites, per `proxy.md:431-466`), never on a single response object. Add a test where `getClaims` triggers `setAll` and the forwarded request still carries the header. If `_rsc` is observed in the search string (see manual step 6.7), strip it when building the path.

#### 3. Coverage gate for the new core

**File**: `vitest.config.mts`

**Intent**: Keep the global 80% gate and add a stricter glob threshold (`lib/auth/**` ≥ 90%) so the security-critical logic can't silently erode. Add `lib/auth/request-path.ts` (a thin `next/headers` adapter) to `coverage.exclude`, matching the existing `proxy.ts` / `lib/supabase/server.ts` convention; every other `lib/auth` module, including `redirect-response.ts`, stays under the 90% gate.

#### 4. E2E

**File**: `e2e/route-guard.spec.ts`, `playwright.config.ts`, `e2e/session-expiry.spec.ts`

**Intent**: Cover every criterion in a real browser. Also update the two logged-out `/dashboard` assertions in `e2e/session-expiry.spec.ts:98,106` from `/\/login$/` to `/\/login\?next=%2Fdashboard$/` (the redirect now carries `next`). Add `E2E_TEST_HOOKS=1` to the `webServer.command`. Cases (seed the user with the same pattern as `e2e/login.spec.ts`; one Supabase instance, single worker):
1. Logged-out `request.get("/dashboard", {maxRedirects: 0})` → 307, `Location: /login?next=%2Fdashboard`, `Cache-Control` no-store, body free of dashboard markup; `/` → `next=%2F`.
2. (Proves routing + the generic 404 only: `/applications/[id]` doesn't exist yet, so this is an unmatched route, not a missing or foreign record. The record-level check moves to the Feature 1 plan, using `notFoundIfMissing`.) Deep link `/applications/123?tab=notes` → login (return strip visible) → after login URL is exactly `/applications/123?tab=notes` and the not-found screen shows with a working "Go to Dashboard" link and no record data (covers deleted/non-owned-record criterion).
3. Table: `?next=https://evil.com`, `//evil.com`, `/\evil.com`, `/login`, `/reset-password` → land on `/dashboard`.
4. Fail-closed: after login set cookie `e2e-session-check=fail`; `/dashboard` shows 00.6 at the same URL (no redirect, no dashboard text); clear cookie, click **Try Again** → dashboard renders; session cookies were never cleared in between.
5. RLS: authenticated user A cannot read user B's seeded `applications` row through the anon client (admin client seeds the row) — zero rows returned.

#### 5. CI

**File**: `.github/workflows/playwright.yml`

**Intent**: No structural change expected (it already runs `supabase start` and `npm run test:e2e`); verify the new spec runs there and the report artifact uploads on failure.

### Success Criteria:

#### Automated Verification:

- Unit suite + coverage gates (80% global, 90% `lib/auth/**`): `npm run test:coverage`
- Lint, types, build: `npm run lint && npx tsc --noEmit && npm run build`
- GitHub Actions `unit-tests` and `e2e-tests` jobs green on the branch (E2E suite including `route-guard.spec.ts`; authoritative Linux Chromium run)

#### Manual Verification:

- On the Vercel preview, `curl -sI https://<preview>/dashboard` shows `307`, `location: /login?next=%2Fdashboard`, and `cache-control: private, no-store, max-age=0` (confirms headers survive the CDN).
- Confirm the seam is inert on the preview/production build: setting the `e2e-session-check` cookie has no effect.
- With an expired session, click a protected `Link` (client-side navigation) and inspect the resulting `/login?next=…`: `next` must not contain `_rsc` or other internal params.
- Walk the full journey once by hand: logged-out deep link → login → back on the deep link; log out/in in two tabs.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before archiving the change.

---

## Testing Strategy

### Unit Tests:

- **Pure core (`__tests__/lib/auth/`)**: table-driven `resolvePostLoginPath` (≈ 25 rows incl. every open-redirect vector), `buildLoginRedirectUrl`/`buildSessionExpiredUrl` encoding (`?tab=notes` survives), `describeDestination`, `decideRouteAccess` (public/protected × three auth states), `classifyClaimsResult`/`classifyThrown` (each error class), `applyTestSessionOverride`, `notFoundIfMissing`, `createAuthRedirect`.
- **DAL**: `createRequireSession` with injected fakes — no hidden globals.
- **Components**: Testing Library + `user-event` for `ReturnStrip`, `LoginForm` (hidden field), `SessionCheckFailed` (focus, `<ol>`, retry, link), `not-found`.
- **Actions/routes**: `login()` redirect targets; `session-expired` handler `next` handling.
- Mocking follows existing conventions (`vi.hoisted` + `vi.mock("next/navigation")`, `__tests__/dashboard/page.test.tsx:1-20`).
- Targets: ≥ 80% global (currently 93.8% statements) and ≥ 90% for `lib/auth/**`. `proxy.ts` remains coverage-excluded by design; its logic is extracted and covered.

### Integration Tests:

- Playwright `e2e/route-guard.spec.ts` (cases 1–5 above) plus the existing `login`, `signup`, `session-expiry` specs updated for the route-group move where needed.

### Manual Testing Steps:

1. Logged out, open `/dashboard` → land on login with the return strip, no flash of dashboard.
2. Open `/applications/123?tab=notes`, log in → not-found page with Go to Dashboard.
3. Try each malicious `next` value in the URL → `/dashboard` after login.
4. Stop local Supabase, reload a protected page while logged in → 00.6 appears, session cookies intact; start Supabase, Try Again → dashboard.
5. Keyboard-only and screen-reader pass through 00.5, 00.6, 00.7.

## Performance Considerations

The proxy adds no extra network call (it reuses the existing `getClaims()`); `requireSession()` is `cache()`-memoised per request so layout and page share one lookup. `MAX_NEXT_LENGTH` bounds header/URL size.

## Migration Notes

No database migration. File moves: `app/dashboard/*` → `app/(protected)/…` and `app/signup/{AuthLogo,styles}` → `components/auth/`; update test imports in the same commits. No URL changes. `/api/auth/session-expired` keeps its URL and gains an optional `next` query parameter.

## References

- Related research: `context/changes/redirect-unauthenticated-users/research.md`
- Wireframes: `supabase/docs/nextjoblog-mvp-screens.html:517-584` (screens 00.5 / 00.6 / 00.7)
- Schema / RLS: `supabase/docs/Nextjoblog-supabase-schema.md` §3
- Next 16 docs: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `…/03-file-conventions/{proxy,route-groups,not-found,page}.md`
- Pattern to copy for injected stores: `lib/session/extension-store.ts`
- Prior stories: `context/changes/stay-logged-in-across-browser-sessions/`, `context/archive/2026-09-07-log-in-an-existing-account/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure auth-redirect core

#### Automated

- [x] 1.1 New unit tests pass for lib/auth core — 6fa5609
- [x] 1.2 resolvePostLoginPath table covers every story and NFR case — 6fa5609
- [x] 1.3 Coverage for lib/auth/** is at least 90% — 6fa5609
- [x] 1.4 Type checking passes — 6fa5609
- [x] 1.5 Linting passes — 6fa5609

#### Manual

- [x] 1.6 Code review: no magic strings or numbers outside paths.ts, no framework imports in pure modules — 6fa5609

### Phase 2: Promote shared auth UI

#### Automated

- [x] 2.1 All existing tests still pass — aaafbf6
- [x] 2.2 No stale imports from app/signup AuthLogo or styles — aaafbf6
- [x] 2.3 Type checking passes — aaafbf6
- [x] 2.4 Linting passes — aaafbf6

#### Manual

- [x] 2.5 Login and signup render identically to before — aaafbf6

### Phase 3: Login honours next

#### Automated

- [x] 3.1 login() action tests cover valid, malicious, auth-path, and missing next values
- [x] 3.2 Login page and form tests cover hidden field, return strip, and heading variants
- [x] 3.3 Coverage thresholds hold including app/actions/auth.ts
- [x] 3.4 Type checking and lint pass

#### Manual

- [x] 3.5 Login with a valid next shows the return strip; malicious next shows the plain login page
- [x] 3.6 Keyboard navigation and focus rings verified on the login page

### Phase 4: Session classification and DAL

#### Automated

- [ ] 4.1 Classifier and service tests cover all failure paths without signOut
- [ ] 4.2 DAL tests with injected dependencies cover all branches
- [ ] 4.3 Test seam is inert unless both env conditions and cookie hold
- [ ] 4.4 session-expired route forwards sanitized next and sets Cache-Control
- [ ] 4.5 Coverage gates hold (80% global, 90% lib/auth)
- [ ] 4.6 Type checking and lint pass

#### Manual

- [ ] 4.7 Session cookies are not cleared when Supabase is unreachable

### Phase 5: Protected route group and screens

#### Automated

- [ ] 5.1 Dashboard page tests cover authenticated and verification_failed states
- [ ] 5.2 SessionCheckFailed component tests pass
- [ ] 5.3 not-found page and notFoundIfMissing tests pass
- [ ] 5.4 Home page redirect test passes
- [ ] 5.5 Full suite and coverage gate pass
- [ ] 5.6 Production build succeeds
- [ ] 5.7 Type checking and lint pass

#### Manual

- [ ] 5.8 Both / and /dashboard end at /dashboard when logged in
- [ ] 5.9 Screens 00.6 and 00.7 match the wireframe and are keyboard and screen-reader accessible

### Phase 6: Proxy wiring and E2E

#### Automated

- [ ] 6.1 Unit suite and coverage gates pass
- [ ] 6.2 Lint, types, and build pass
- [ ] 6.3 GitHub Actions unit-tests and e2e-tests jobs are green including route-guard.spec.ts

#### Manual

- [ ] 6.4 Vercel preview redirect returns 307 with correct Location and no-store headers
- [ ] 6.5 Test seam confirmed inert on the preview build
- [ ] 6.6 Full deep-link journey walked by hand
- [ ] 6.7 Client-side navigation with an expired session yields a clean next value
