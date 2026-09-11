# Stay Logged In Across Browser Sessions Implementation Plan

## Overview

Enforce Supabase's built-in 30-day session `timebox` so a logged-in user stays authenticated across browser restarts without re-entering credentials; have `proxy.ts` clear cookies once a session is confirmed expired while treating missing/corrupted sessions as a silent logged-out state; and add the app's first client-side session-expiry awareness to show a day-28–30 "session expiring soon" notice with Yes/No, without implementing the Yes action itself (Story 0.3b). Backfill 80%+ enforced test coverage as part of the same change.

## Current State Analysis

- `proxy.ts` and `lib/supabase/server.ts` both call `getClaims()`/rely on `@supabase/ssr` cookie refresh, which currently refreshes forever — there is no session lifetime boundary anywhere in the stack. Cookies default to a 400-day `Max-Age` (`@supabase/ssr`'s `DEFAULT_COOKIE_OPTIONS`), and `[auth.sessions]` in `supabase/config.toml:270-275` is commented out.
- No browser-side Supabase client exists in the repo (`createBrowserClient` has zero references) — everything today is Server Component/Action only.
- No `/dashboard` route exists yet; `signup`/`login` both already `redirect("/dashboard")` on success (`app/actions/auth.ts:88,134`), so it's a pre-existing stub target.
- No coverage tooling is configured (`vitest.config.mts` has no `coverage` block, no `@vitest/coverage-*` in `devDependencies`).
- Two established conventions this plan extends rather than replaces: the Server/Client component split (`page.tsx` → Client Component → `Fields`/`Alert` → shared `styles.ts`/`AuthLogo.tsx`), and real-Supabase, nothing-mocked Playwright e2e tests seeded via the actual UI.

## Desired End State

A user who closes the browser and reopens the app within 30 days of login stays logged in with no re-entry of credentials. Between day 28 and day 30 of an open session, the app shows a dismissable modal offering to stay logged in; once answered (or dismissed) it does not reappear for that session. A session past day 30, or a missing/corrupted session, is silently treated as logged out and lands the user on the login page — never an error screen. RLS continues to scope every query to the restored user. `npm run test:run` enforces ≥80% coverage.

Verification: `npm run test:run` passes with coverage ≥80%; `npm run test:e2e` passes, including a real (shortened-timebox) session-expiry test, a cookie-tampering test, and an RLS-after-restore test; manually reopening the app with a real 30-day-old local session cookie shows the login page, not an error.

### Key Discoveries:

- `getClaims()`'s returned JWT payload does **not** include a session-level `created_at` — only the 1-hour access-token `iat`/`exp` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:5296-5326`, JSDoc example claims shape). It does include `amr` (Authentication Methods Reference), an array of `{ method, timestamp }` entries populated at actual authentication time and **not** appended to on token refresh, plus a `session_id` that stays stable across refreshes. `amr[0].timestamp` is therefore the correct source for "when this session began" — `amr[0].timestamp + 30d` is the session's real expiry, and `expiry − 2d` is the day-28 notice threshold.
- `supabase/config.toml:270-275` — commented-out `[auth.sessions]` block; GoTrue's config parser is Go's `time.ParseDuration` (no day unit), so 30 days must be expressed as `"720h"`.
- The hosted Supabase project (confirmed via `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`, deployed on Vercel, auto-deploys `main`) has its own, separate `timebox` setting in the dashboard — local `config.toml` does not propagate to it. This plan ships the code and local config; flipping the hosted setting is a deliberate, separate manual step taken **after** this change is deployed (see Migration Notes) — not part of this plan's automated changes, because enabling it retroactively logs out any session already past 30 days the moment it's flipped.

## What We're NOT Doing

- No route-guard/redirect-when-unauthenticated logic for `/dashboard` or any other route — that is Story 0.4, which explicitly depends on this story landing first.
- No implementation of the "Yes" action's session extension (60-day math) — Story 0.3b. This story renders the Yes button and marks the notice as responded-to; it does not wire an extension handler.
- No "remember me" opt-out — sessions always persist for the full 30-day window.
- No design/build-out of real dashboard content — `app/dashboard/` in this plan is a minimal placeholder solely to host the redirect target and the expiry-notice Client Component.
- No automated push of the hosted Supabase dashboard `timebox` setting — documented as a manual post-deploy step, not scripted, since there's no existing CI/deploy automation for Supabase config in this repo.

## Implementation Approach

Layer the change from the bottom up: enable the server-side enforcement mechanism first (Supabase's own `timebox`, not hand-rolled JWT/cookie logic — consistent with this app's existing "delegate to Supabase Auth primitives" architecture), then teach `proxy.ts` to react to an expired-but-structurally-valid session by clearing cookies, then add the minimum client-side plumbing needed to compute and display the day-28–30 notice, and finally backfill coverage tooling and e2e verification. Each phase is independently testable and the ordering means later phases can rely on earlier ones already being correct.

## Phase 1: Session Timebox Enforcement

### Overview

Enable Supabase Auth's own 30-day session lifetime so a session is invalid at the identity-provider level after 30 days, independent of client cookie state.

### Changes Required:

#### 1. Local Supabase session timebox

**File**: `supabase/config.toml`

**Intent**: Uncomment and configure the `[auth.sessions]` block so GoTrue enforces a flat 30-day session lifetime for the local dev/test stack.

**Contract**: Uncomment lines 270-275; set `timebox = "720h"`; leave `inactivity_timeout` commented out (not requested by this story — base session is a flat 30-day window, not an inactivity window).

### Success Criteria:

#### Automated Verification:

- `supabase config` validates without error (e.g. `supabase db lint` or `supabase start` succeeds locally)
- Existing e2e suite (`npm run test:e2e`) still passes unchanged — a normal login within the 30-day window is unaffected

#### Manual Verification:

- `supabase start` boots locally with the new config and a fresh login still succeeds

---

## Phase 2: Expired and Invalid Session Handling in `proxy.ts`

### Overview

Make the session-refresh proxy distinguish "confirmed expired" (timebox exceeded, but the cookie was structurally a real session) from "missing/corrupted" (nothing meaningful to identify), and react correctly to each — matching the resolved edge cases in `research.md`.

### Changes Required:

#### 1. Proxy expiry branch

**File**: `proxy.ts`

**Intent**: After `getClaims()`, if it reports the session is expired (the GoTrue `session_not_found`/timebox-exceeded case) rather than simply missing/corrupted, explicitly clear the auth cookies on the response. A missing or corrupted session needs no clearing — there's nothing valid to identify — and must not surface as an error; the request just continues on to render whatever the (now-logged-out) request produces.

**Contract**: `getClaims()`'s error result must be inspected to distinguish "confirmed expired session" from "no session at all" (e.g. via the `AuthSessionMissingError` code already used elsewhere in `app/actions/auth.ts`, versus a distinct expired/timebox error code returned by GoTrue). Only the confirmed-expired branch clears cookies — and does so by enumerating the request's actual cookie names via `getAll()` filtered by the auth storage-key prefix (mirroring `@supabase/ssr`'s own `isChunkLike` check, or by reusing its `clearAuthCookiesAtScopes` helper directly), not a fixed literal name list, since `@supabase/ssr` may split a large session into chunked cookies (`sb-<project-ref>-auth-token.0`, `.1`, ...) and a fixed-name delete would silently miss them. This is the first conditional/error-branching logic in `proxy.ts` — it must stay "optimistic" (cookie/claims-only, no DB round-trip) per the existing architecture, and must not throw — any error path falls through to treating the request as logged out.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run test:e2e` — new cookie-tampering test (Phase 6) passes

#### Manual Verification:

- Manually setting an expired-but-structurally-valid session cookie and reloading the app clears the cookie and shows the login page, not an error
- Manually corrupting a cookie value and reloading shows the login page without a server error

---

## Phase 3: Dashboard Placeholder and Expiry Plumbing

### Overview

Give `signup`/`login`'s existing `redirect("/dashboard")` a real destination, and compute the current session's expiry server-side so it can be handed to a Client Component.

### Changes Required:

#### 1. Dashboard route

**File**: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`

**Intent**: A minimal placeholder page/layout — no real dashboard content, no auth guard (Story 0.4's job) — that exists solely so `redirect("/dashboard")` lands somewhere real and so the expiry-notice Client Component has a Server Component parent to compute expiry in.

**Contract**: `layout.tsx` is a Server Component that calls `getClaims()` via `createServerSupabaseClient()`, computes `sessionExpiresAt = amr[0].timestamp + 30 days` (per Key Discoveries) when claims are present, and renders `children` alongside the notice component from Phase 4, passing `sessionExpiresAt` as a prop. When claims are absent (defensive — Story 0.4 will later gate this route), render `children` without the notice component rather than throwing.

### Success Criteria:

#### Automated Verification:

- `npm run typecheck` (or `tsc --noEmit`) passes
- `npm run lint` passes

#### Manual Verification:

- Logging in redirects to `/dashboard` and the placeholder renders without error

---

## Phase 4: Day-28–30 Expiry Notice Modal

### Overview

Show the "your session is expiring soon" modal any time the app is open between day 28 and day 30 of the session, with Yes/No buttons, and don't show it again once responded to within that window.

### Changes Required:

#### 1. Notice component

**File**: `app/dashboard/SessionExpiryNotice.tsx`

**Intent**: A Client Component that receives `sessionExpiresAt` as a prop, checks on mount whether "now" is already past the day-28 threshold (`sessionExpiresAt - 2 days`) and a `responded` cookie has not been set — showing the modal immediately if so, or scheduling a single `setTimeout` to the threshold otherwise. Renders a dialog with Yes and No buttons; both currently just set the `responded` cookie and dismiss (the Yes action's actual session-extension behavior is Story 0.3b's — this component only exposes the button for it to wire a handler into later).

**Contract**: Pure function `getNoticeState(now, sessionExpiresAt, hasResponded)` (exported and independently unit-testable) returns whether to show the modal — no hidden globals, `now`/`sessionExpiresAt` are injected, not read from `Date.now()` inside the function. The `responded` cookie is written via `document.cookie` from the Client Component (no server round-trip needed for a client-only "don't show again" flag) with an explicit `expires` set to `sessionExpiresAt` (the same prop the component already receives) — a plain `document.cookie` write with no expiry defaults to a browser-session cookie that is cleared on browser close, which would defeat the Happy Path's close/reopen-the-browser scenario during the day-28–30 window and re-show a notice the user already answered. Tying `expires` to `sessionExpiresAt` makes the flag survive browser restarts for the rest of the session's real life and naturally disappear once the session itself would be gone (or be overwritten by a fresh session's cookie on next login). Dialog uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and traps focus between Yes/No/close on Tab; Escape and the No button both dismiss and set `responded`.

#### 2. Wire into dashboard layout

**File**: `app/dashboard/layout.tsx`

**Intent**: Render `<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />` alongside `children` when `sessionExpiresAt` is available.

**Contract**: No new exports beyond the existing layout contract from Phase 3.

### Success Criteria:

#### Automated Verification:

- Unit tests for `getNoticeState` cover: before day 28 (no show), exactly at/after day 28 with no response (show), after response regardless of time-in-window (no show), after day 30 (out of this component's concern — Phase 2 already logged the user out before this would render)
- Unit tests for `SessionExpiryNotice` (mocked timers) cover: immediate show when mounted already past threshold, scheduled show via `setTimeout`, Yes/No both dismiss and set the cookie
- `npm run test:run` passes with coverage thresholds met (Phase 5)
- `npm run lint` passes (includes jsx-a11y checks via `eslint-config-next`)

#### Manual Verification:

- With a session artificially aged past day 28 locally, the modal appears on dashboard load; clicking No dismisses it and it does not reappear on reload
- Keyboard-only navigation (Tab/Shift+Tab/Escape) can open, navigate, and dismiss the modal

---

## Phase 5: Test Coverage Tooling

### Overview

Make "80% test coverage" an objective, enforced criterion rather than a manual check.

### Changes Required:

#### 1. Coverage provider and threshold

**File**: `vitest.config.mts`, `package.json`

**Intent**: Add `@vitest/coverage-v8`, pinned to the same version as the already-installed `vitest` core package (`4.1.11`) for consistency rather than a loose range, and configure `test.coverage` with 80% thresholds so a normal `test:run` fails under-target; add a `test:coverage` script for explicit local reports.

**Contract**: `package.json` gets `"@vitest/coverage-v8": "4.1.11"` (exact match to the installed `vitest` version — this package is versioned in lockstep with Vitest core, and pinning it identically avoids a mismatched-version resolution error). `test.coverage.provider = "v8"`, `test.coverage.thresholds = { lines: 80, statements: 80, functions: 80, branches: 80 }`, scoped to `include`/`exclude` patterns that exclude non-unit-testable files already called out in `research.md` (`proxy.ts`, `lib/supabase/server.ts` — covered by e2e, not Vitest, per the existing testing convention) so the threshold measures what Vitest can actually exercise.

### Success Criteria:

#### Automated Verification:

- `npm run test:run` reports coverage and fails if any metric is below 80%
- `npm run test:coverage` prints a coverage summary

#### Manual Verification:

- None — this phase is self-verifying via its own automated criteria

---

## Phase 6: E2E Verification

### Overview

Prove the real 30-day/day-28 behavior end-to-end against actual GoTrue enforcement (not mocked), plus the corrupted-cookie and RLS-after-restore requirements.

### Changes Required:

#### 1. Short-timebox local test project

**File**: `supabase-test/` (new directory, sibling to `supabase/`) — `supabase-test/config.toml`, `supabase-test/migrations/` (copied from `supabase/migrations/`), `supabase-test/seed.sql` (copied from `supabase/seed.sql` if present)

**Intent**: A dedicated, fully separate local Supabase project used only for the expiry e2e test, with `timebox` set short enough to observe real expiry within a test run while preserving the day-28-of-30 ratio (i.e. the notice threshold at ~2/3 of the shortened window). A sibling config *file* is not viable: the Supabase CLI (confirmed via `supabase start --help` on the installed v2.116.0) has no flag to point `supabase start` at an alternate `.toml` file — `--workdir` only accepts a whole project directory, which must contain its own `config.toml`, migrations, and seed data.

**Contract**: `supabase-test/config.toml` is a copy of `supabase/config.toml` with `timebox` overridden to a short value (e.g. `"10s"`); its header comments this is test-only, never used by `npm run dev`. Migrations under `supabase-test/migrations/` must be kept identical to `supabase/migrations/` (a comment in both directories cross-references the other, flagging drift risk). Started via `supabase start --workdir supabase-test`, documented in the e2e test's own header comment (mirroring the existing single-worker-mode comment convention in `e2e/login.spec.ts`) and stopped via `supabase stop --workdir supabase-test` after the run so it doesn't collide with the normal dev stack's containers/ports.

#### 2. Session expiry e2e test

**File**: `e2e/session-expiry.spec.ts` (new)

**Intent**: Against the short-timebox local stack, log in, wait past the shortened day-28-equivalent mark and assert the modal appears, then wait past full expiry and assert the app treats the user as logged out on reload.

**Contract**: Follows `e2e/login.spec.ts`'s conventions — `test.describe.configure({ mode: "default" })`, `getByRole`/`getByTestId` assertions, real signup/login via the UI, no mocking.

#### 3. Corrupted/missing session e2e test

**File**: `e2e/session-expiry.spec.ts` (same file, additional tests)

**Intent**: Using `context.addCookies` to set a missing/garbled Supabase auth cookie, assert the app shows the login page on load rather than an error screen.

**Contract**: Runs against the normal (720h) local stack — this test proves the app's reaction to a bad cookie shape, not real GoTrue enforcement, so it does not need the short-timebox config.

#### 4. RLS-after-restore e2e test

**File**: `e2e/session-expiry.spec.ts` (same file, additional test)

**Intent**: Mirror `e2e/login.spec.ts:76-126`'s two-user RLS test, but against a session restored from a persisted cookie (simulating "reopen the browser") rather than a fresh login, proving RLS still scopes results to the restored user.

**Contract**: Reuses the existing `supabaseAdmin`-seeded two-user pattern; the only delta is establishing the session via cookie restoration (`context.storageState`/`context.addCookies` from a prior sign-in) rather than a fresh `signInWithPassword` call.

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e` passes, including all new tests in `e2e/session-expiry.spec.ts`
- The `supabase-test/` short-timebox project is documented and does not interfere with `npm run dev` or the existing e2e suite's default (720h) stack (separate `--workdir`, stopped after the run)

#### Manual Verification:

- A full local `supabase start` + `npm run test:e2e` run is executed at least once and its output reviewed (not just assumed green) before this phase is marked done — per the repeated prior-review lesson against marking e2e "done" without an actual run

---

## Testing Strategy

### Unit Tests:

- `getNoticeState` pure function: full boundary coverage (before/at/after day 28, after response, after day 30)
- `SessionExpiryNotice` component: mocked timers, mocked `document.cookie`, Yes/No interaction, a11y attributes present
- Existing `LoginForm`/`SignupForm`/`password-validation` suites untouched

### Integration Tests:

- Covered via the e2e layer (Phase 6) — `proxy.ts` and `lib/supabase/server.ts` are not Vitest-testable per existing convention

### Manual Testing Steps:

1. Log in, close the browser, reopen within 30 days — confirm still logged in
2. Artificially age a local session cookie/session past day 28 — confirm the modal appears once and doesn't reappear after dismissal
3. Artificially age a session past day 30 — confirm the app treats it as logged out with no error screen
4. Corrupt a cookie value directly — confirm the app shows the login page, not an error
5. Restore a session from a persisted cookie and confirm a data request only returns that user's own rows

## Performance Considerations

`proxy.ts` remains a single, cheap `getClaims()` call plus (at most) one cookie-delete branch — no new network round-trips or DB queries are added to the existing per-request path.

## Migration Notes

After this change is merged and deployed:

1. In the hosted Supabase project's dashboard (Authentication → Sessions), set the session timebox to 30 days (`720h`-equivalent), as a separate, deliberate action — **not** as part of this deploy. This is intentional: `timebox` evaluates retroactively against each session's actual start time, so flipping it immediately logs out any already-logged-in user whose session already exceeds 30 days, with no chance to see the day-28 notice first. Time and watch this step deliberately rather than letting it happen as a side effect of the merge landing.

## References

- Related research: `context/changes/stay-logged-in-across-browser-sessions/research.md`
- Session-refresh proxy: `proxy.ts:1-43`
- Server Supabase client: `lib/supabase/server.ts:1-27`
- Existing redirect targets: `app/actions/auth.ts:88`, `:134`
- Commented-out timebox config: `supabase/config.toml:270-275`
- `getClaims()` JWT claims shape: `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:5296-5326`
- Existing two-user RLS e2e pattern to mirror: `e2e/login.spec.ts:76-126`
- Component-split convention: `app/login/LoginForm.tsx`, `app/login/LoginAlert.tsx`, `app/signup/styles.ts`, `app/signup/AuthLogo.tsx`
- Unit test convention: `__tests__/login/LoginForm.test.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Session Timebox Enforcement

#### Automated

- [x] 1.1 Supabase config validates without error — 342288c
- [x] 1.2 Existing e2e suite still passes unchanged — 342288c

#### Manual

- [x] 1.3 `supabase start` boots locally with new config and login still succeeds — 342288c

### Phase 2: Expired and Invalid Session Handling in `proxy.ts`

#### Automated

- [x] 2.1 `npm run lint` passes — 4a2d286
- [ ] 2.2 Cookie-tampering e2e test passes

#### Manual

- [x] 2.3 Expired-but-valid cookie is cleared and shows login page, not an error — 4a2d286
- [x] 2.4 Corrupted cookie shows login page without a server error — 4a2d286

### Phase 3: Dashboard Placeholder and Expiry Plumbing

#### Automated

- [x] 3.1 Typecheck passes
- [x] 3.2 Lint passes

#### Manual

- [x] 3.3 Login redirects to `/dashboard` and placeholder renders without error

### Phase 4: Day-28–30 Expiry Notice Modal

#### Automated

- [ ] 4.1 `getNoticeState` unit tests cover all boundary cases
- [ ] 4.2 `SessionExpiryNotice` unit tests cover show/schedule/Yes/No
- [ ] 4.3 `npm run test:run` passes with coverage thresholds met
- [ ] 4.4 Lint (incl. a11y) passes

#### Manual

- [ ] 4.5 Modal appears once past day 28, doesn't reappear after dismissal
- [ ] 4.6 Keyboard-only navigation can open, navigate, and dismiss the modal

### Phase 5: Test Coverage Tooling

#### Automated

- [ ] 5.1 `npm run test:run` enforces and fails under 80% coverage
- [ ] 5.2 `npm run test:coverage` prints a summary

### Phase 6: E2E Verification

#### Automated

- [ ] 6.1 `npm run test:e2e` passes including all `e2e/session-expiry.spec.ts` tests
- [ ] 6.2 `supabase-test/` short-timebox project doesn't interfere with dev or the existing e2e suite

#### Manual

- [ ] 6.3 Full local `supabase start` + `npm run test:e2e` run executed and reviewed
