# Extend Sessions Through Stay-Logged-In Confirmations Implementation Plan

## Overview

Story 0.3 shipped the day-28–30 "Stay logged in?" notice, but today both Yes and No call the identical `onDismiss` handler — clicking either just sets a cookie and hides the dialog. This plan gives Yes a real, distinct effect: it extends the session's application-managed expiry by 30 days from its current expiry, repeating indefinitely with no cap, while No or no response lets that cycle expire on schedule. Because Supabase's GoTrue has no supported API to move a session's `timebox` anchor forward, the extension becomes an app-owned concept backed by a new `session_extensions` table, with the application itself now responsible for enforcing its own computed expiry (GoTrue's fixed ceiling is removed from production).

## Current State Analysis

- `app/dashboard/SessionExpiryNoticeDialog.tsx` — both buttons call `onDismiss`; no server call happens on either click today.
- `app/dashboard/useSessionExpiryNotice.ts` — `dismiss()` sets a single `session_expiry_responded=1` cookie (expiring at `sessionExpiresAt`) and hides the dialog. The cookie is a flat boolean, not keyed to *which* cycle it answered.
- `app/dashboard/session-expiry-notice.ts` — pure, already-tested `getNoticeState`/`getNextNoticeCheckDelay` functions; the day-28–30 window math this plan must keep intact.
- `app/dashboard/layout.tsx` — computes `sessionExpiresAt` as a pure function of `amr[0].timestamp + sessionLifetimeMs`, with **no DB read**. This computation moves into a shared `lib/session.ts` helper that both `layout.tsx` (notice UI) and `app/dashboard/page.tsx` (enforcement) call — see Phase 3.
- `proxy.ts` — clears auth cookies only when GoTrue itself reports `session_expired`; has no awareness of application-managed expiry and, per research, must stay DB-free.
- `supabase/config.toml` — `[auth.sessions] timebox = "720h"` is the current hard 30-day ceiling GoTrue enforces independent of the app.
- `supabase-test/supabase/config.toml` — separate short-timebox project (`timebox = "30s"`) used only by `e2e/session-expiry.spec.ts`'s short-timebox describe block; unaffected by the production `timebox` removal.
- No `session_extensions` table exists yet; every existing user-scoped table (`applications`, `cv_documents`, etc.) follows the same `user_id references auth.users(id)` + `auth.uid() = user_id` RLS shape in `supabase/migrations/20260902082510_create_tables.sql` / `20260902082511_create_rls_policies.sql`, manually mirrored to `supabase-test/supabase/migrations/`.
- `app/actions/auth.ts` establishes the Server Action convention this plan extends: `"use server"`, a `*FormState` discriminated union, specific-error-code checks before a generic `{ error: "unknown", message }` fallback, `redirect()` called after try/catch (never inside it).
- `.github/workflows/playwright.yml` (repo root, `../.github/workflows/` relative to `nextjoblog/`) has a single `e2e` job; `package.json` has `test:run` (the working non-watch Vitest command) but no `test:unit` alias.
- `vitest.config.mts` enforces 80% coverage on lines/statements/functions/branches, excluding only `proxy.ts` and `lib/supabase/server.ts`.

## Desired End State

Clicking Yes in the notice dialog extends the session's application-managed expiry by 30 days past its current expiry (not from the click), dismisses the dialog, and the same notice-and-extend cycle fires again 2 days before whatever the new expiry becomes — repeating with no cap for as long as the user keeps confirming. Clicking No, letting the prompt time out unanswered, or closing the app leaves that cycle's expiry untouched; when it passes, the app signs the user out. A failed extension attempt shows an inline error and leaves the original expiry in place. `npm run test:run` passes with coverage ≥80%; a new e2e test proves at least two extension cycles.

Verification: `npm run test:run` (coverage ≥80%) and `npm run test:e2e` (including the new multi-cycle extension test and the `session_extensions` RLS test) both pass; manually clicking Yes twice on a short-timebox session shows the expiry pushed out each time and the notice reappearing on schedule.

### Key Discoveries:

- `refreshSession()` does not touch `amr`/`session_id` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3198-3260`), and `GoTrueAdminApi.js` has no session-timing endpoint — confirmed no Supabase-native way to extend a session's timebox anchor (research.md §2).
- `amr[0].timestamp` (login-time claim, stable across refreshes) plus 30 days is the session's *base* expiry; `session_extensions.extended_until` is the *latest* expiry once at least one extension has succeeded. The effective expiry is always the later of the two.
- The extension-check DB read is locked to `app/dashboard/` (`layout.tsx` for the notice, `page.tsx` for enforcement) — `proxy.ts` stays DB-free (research.md, "Current Decision Status"). Enforcement is deliberately not centralized in `layout.tsx` itself; see Phase 3.
- `session_extensions` is one row per `session_id` (upserted, not appended) — `session_id` is the primary key, `user_id` is the RLS ownership FK, `extended_until` is the latest computed expiry.

## What We're NOT Doing

- No route-guard/redirect-when-unauthenticated for routes other than the dashboard's own expiry enforcement — Story 0.4 is a separate, later concern.
- No cap on total elapsed time across repeated extensions — explicitly out of scope per the story.
- No silent/automatic extension — every extension requires an explicit Yes on that cycle's prompt.
- No change to the day-28–30 notice window math (`getNoticeState`/`getNextNoticeCheckDelay`) beyond what's needed to key it off the effective (possibly extended) expiry.
- No hosted/production Supabase dashboard `timebox` toggle automation — flipping the hosted setting remains a manual post-deploy step (same boundary Story 0.3's plan drew).
- No extension-history table — each Yes upserts the single row per `session_id` rather than appending an audit log.

## Implementation Approach

Build bottom-up: the DB schema first (the new source of truth), then the Server Action that writes to it, then the shared effective-expiry helper and the `page.tsx` enforcement path that makes the extension actually count (including signing the user out when unextended), then the client wiring that calls the action and reacts to its result, then test coverage, then the CI split. Each phase is independently verifiable and later phases depend on earlier ones being correct.

## Critical Implementation Details

### Application takes over expiry enforcement from GoTrue

Removing the production `timebox` means GoTrue itself will never expire this session — there's no hard backstop from Supabase Auth if the app fails to enforce its own expiry. This project's own Next.js docs (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1368`) warn that a shared layout is not a reliable enforcement point: layouts don't re-render on client-side navigation, and a layout does not stop the route's own page/leaf segments from rendering or appearing in the RSC payload — "a common pattern... is to `return null` in a layout... if a user is not authorized. This pattern is **not recommended**." Enforcement therefore lives in `app/dashboard/page.tsx` (and must be repeated in any future dashboard route added under `app/dashboard/`), matching the docs' documented "Auth checks in page components" pattern: when computed effective expiry has passed, the page must call `supabase.auth.signOut()` then `redirect("/login")` before rendering any dashboard content. `layout.tsx` still reads the effective expiry, but only to drive the existing notice UI — it is no longer the enforcement point. This is a deliberate, permanent shift in responsibility, not a temporary gap — get this wrong and a session with a lapsed cycle stays silently alive.

### Cycle-keyed responded cookie

The existing `session_expiry_responded` cookie is a flat `=1` flag with no cycle identity, so after a first extension it would incorrectly suppress the *next* cycle's notice (which has a new, later expiry). The cookie's value must become the expiry timestamp it answered (e.g. `session_expiry_responded=<sessionExpiresAt>`), and `hasRespondedCookie()` must compare the stored value against the *current* cycle's `sessionExpiresAt` rather than just checking presence. A mismatch means a new cycle has started and the notice is eligible again.

## Phase 1: `session_extensions` Table and RLS

### Overview

Add the app-owned table that becomes the source of truth for extended session expiry, following this repo's existing RLS convention exactly, mirrored to both migration directories.

### Changes Required:

#### 1. New migration: table + RLS policy

**File**: `supabase/migrations/<timestamp>_create_session_extensions.sql`

**Intent**: Create `session_extensions` as the single-row-per-session record of the latest application-managed expiry, scoped by RLS the same way every other user table in this app is scoped.

**Contract**: `session_id text primary key`, `user_id uuid not null references auth.users(id) on delete cascade`, `extended_until timestamptz not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. Enable RLS; policy `session_extensions_owner` `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`, matching `applications_owner`'s exact shape in `20260902082511_create_rls_policies.sql`.

#### 2. Mirror to the test project

**File**: `supabase-test/supabase/migrations/<same-timestamp>_create_session_extensions.sql`

**Intent**: Keep the manually-mirrored test project in sync per `supabase/migrations/README.md`'s documented drift-risk convention — byte-identical to the file above.

**Contract**: Exact copy of the Phase 1.1 migration file.

#### 3. Remove the production timebox ceiling

**File**: `supabase/config.toml`

**Intent**: Application-managed expiry becomes the real ceiling; GoTrue's own fixed `timebox` must no longer cut sessions off before an extension can apply.

**Contract**: Remove (or comment out) the `timebox = "720h"` line under `[auth.sessions]`, matching Supabase's documented default of no fixed maximum. Leave `supabase-test/supabase/config.toml`'s short `timebox = "30s"` untouched — it exists specifically so `e2e/session-expiry.spec.ts` can observe real GoTrue-level expiry within a test run and is unaffected by this production-only change.

### Success Criteria:

#### Automated Verification:

- `supabase db reset` applies the new migration cleanly against the local `supabase/` project
- `supabase db reset --workdir supabase-test` applies the mirrored migration cleanly
- `diff supabase/migrations/<timestamp>_create_session_extensions.sql supabase-test/supabase/migrations/<timestamp>_create_session_extensions.sql` reports no differences

#### Manual Verification:

- `supabase start` boots locally with `timebox` removed and a fresh login still succeeds

---

## Phase 2: Extend-Session Server Action

### Overview

A Server Action that upserts the current session's `extended_until` to 30 days past its current effective expiry, following `app/actions/auth.ts`'s discriminated-union error-state convention.

### Changes Required:

#### 1. New Server Action

**File**: `app/actions/session.ts`

**Intent**: Given the calling user's current session, compute the next effective expiry (`current effective expiry + 30 days`) and upsert it into `session_extensions` keyed by `session_id`. Reads the current session's `session_id`/`user_id`/`amr[0].timestamp` via `getClaims()`, and the current `session_extensions` row (if any) via `createServerSupabaseClient()`, to determine the *current* effective expiry before adding 30 days — the extension must be computed from the current expiry, not from `Date.now()`.

**Contract**: `export type ExtendSessionState = undefined | { ok: true; extendedUntil: number } | { error: "unknown"; message: string }`. `export async function extendSession(_state: ExtendSessionState): Promise<ExtendSessionState>` — takes the previous state as its sole parameter (unused) so it matches the two-argument shape `useActionState` requires when called with no payload (`useActionState`'s dispatched action always passes `(state, ...args)`; no `FormData` is needed here since there's no form input, only an action trigger). On any Supabase error or a missing/malformed claims shape, return `{ error: "unknown", message: "..." }` and `console.error` the underlying error, mirroring `login`/`signup`'s try/catch shape. No `redirect()` — this dismisses a modal, it doesn't navigate.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Unit tests for the action's pure expiry-math helper pass (see Phase 5)

#### Manual Verification:

- Calling the action against a local session inserts/updates the expected `session_extensions` row (spot-check via `supabase studio` or a direct query)

---

## Phase 3: Application-Managed Expiry and Enforced Sign-Out via Dashboard DAL

### Overview

The effective-expiry computation (later of the base 30-day expiry and any `session_extensions` row) moves into a shared, testable helper, and the actual sign-out enforcement moves to `app/dashboard/page.tsx` rather than `layout.tsx`. Per this project's own Next.js docs (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1368`), a layout does not reliably gate access — it doesn't re-render on client-side navigation, and it doesn't stop child route segments from rendering or appearing in the RSC payload. `layout.tsx` keeps reading the effective expiry, but only to drive the existing notice UI; it is DB-aware but is no longer an enforcement point.

### Changes Required:

#### 1. Shared effective-expiry helper

**File**: `lib/session.ts` (new)

**Intent**: Extract the extension-aware expiry computation into a helper reusable by both `layout.tsx` (for the notice) and `app/dashboard/page.tsx` (for enforcement), following this repo's `lib/` DAL convention (`lib/supabase/server.ts` is the existing precedent for a shared server-only module).

**Contract**: `computeEffectiveSessionExpiresAt(baseExpiresAt: number, extendedUntil: number | undefined): number` returns `Math.max(baseExpiresAt, extendedUntil ?? 0)` — pure, unit-testable in isolation (see Phase 5). `export async function getEffectiveSessionExpiry(): Promise<{ claims: JwtPayload; effectiveExpiresAt: number } | undefined>` reads the current session's claims and its `session_extensions` row via `createServerSupabaseClient()`, and returns the effective expiry using the pure helper above. This is the first DB read on this path — deliberate, per research.md's locked decision to confine it to `app/dashboard/` rather than `proxy.ts`.

#### 2. `layout.tsx` reads the effective expiry for the notice only

**File**: `app/dashboard/layout.tsx`

**Intent**: Replace the current pure `computeSessionExpiresAt` (base expiry only) with a call to `getEffectiveSessionExpiry()` so the notice UI reflects extensions. `layout.tsx` no longer performs sign-out/redirect itself — see 3.3 below.

**Contract**: `const effective = await getEffectiveSessionExpiry(); const sessionExpiresAt = effective?.effectiveExpiresAt;` — passed to `<SessionExpiryNotice>` exactly as `sessionExpiresAt` is today.

#### 3. Enforced sign-out in the dashboard page

**File**: `app/dashboard/page.tsx`

**Intent**: Perform the actual gate close to the rendered content, matching Next.js's documented "Auth checks in page components" pattern (`authentication.md:1370-1408`). Any future dashboard route added under `app/dashboard/` must repeat this same check (or its own leaf-component check), since enforcement is intentionally not centralized in the layout.

**Contract**: `const effective = await getEffectiveSessionExpiry(); if (!effective || Date.now() >= effective.effectiveExpiresAt) { const supabase = await createServerSupabaseClient(); await supabase.auth.signOut(); redirect("/login"); }` — before rendering any dashboard content, and with `redirect()` called outside any try/catch, matching `app/actions/auth.ts`'s established rule that `redirect()` must run outside any try/catch that could swallow its internal throw.

### Success Criteria:

#### Automated Verification:

- Unit tests for `computeEffectiveSessionExpiresAt` pass (pure function, testable independent of the DB call — see Phase 5)
- Type checking passes: `npm run lint`

#### Manual Verification:

- On a short-timebox session, letting the effective expiry pass without extending and then navigating to `/dashboard` lands on `/login`, not an error page
- Extending once, then reaching only the *original* (unextended) expiry, does not sign the user out — proves the extension actually took effect

---

## Phase 4: Client Wiring — Distinct Yes Handler, Cycle-Keyed Cookie, Error UX

### Overview

Give Yes a real effect: call the extend-session action, keep the dialog open with an inline error and retry on failure, dismiss and refresh on success, and fix the responded cookie to be cycle-aware so a past cycle's answer can't suppress the next cycle's prompt.

### Changes Required:

#### 1. Distinct Yes handler with loading/error state

**File**: `app/dashboard/SessionExpiryNoticeDialog.tsx`

**Intent**: Yes and No diverge for the first time. `SessionExpiryNoticeDialog` imports `extendSession` from `app/actions/session.ts` directly and calls it via `useActionState(extendSession, undefined)`, exactly mirroring `LoginForm.tsx`'s direct import of `login` (`app/login/LoginForm.tsx:6,22`) — no callback prop is threaded down from `SessionExpiryNotice` for this. The Yes button invokes the returned `formAction` inside `startTransition` (since it's not bound to a `<form>`), disables itself while `isPending`, and on failure shows an inline error message reusing the existing `danger-tint` alert styling from `app/login/LoginAlert.tsx` — the Yes button stays clickable again for retry. No continues to just call `onDismiss` (unchanged prop).

**Contract**: `SessionExpiryNoticeDialog`'s only props remain `{ onDismiss: () => void }` — no new prop surface. Internally: `const [state, extendAction, isPending] = useActionState(extendSession, undefined)`. Dialog renders the alert only when `state?.error === "unknown"`; a successful extend (`state?.ok`) calls `onDismiss` plus `router.refresh()` so the server-computed `sessionExpiresAt` picks up the new value on next render. The dialog's root `div[role="dialog"]` also carries `aria-busy={isPending}` so screen-reader users get pending-state feedback while the extend call is in flight, alongside the existing `disabled` state on the Yes button.

#### 2. Cycle-keyed responded cookie

**File**: `app/dashboard/useSessionExpiryNotice.ts`

**Intent**: Stop a stale cookie from suppressing the next cycle's notice. Per the Critical Implementation Details section above, the cookie's value becomes the expiry it answered, not a flat `1`.

**Contract**: `setRespondedCookie(sessionExpiresAt)` writes `session_expiry_responded=<sessionExpiresAt>`; `hasRespondedCookie(sessionExpiresAt)` now takes the current cycle's expiry and returns true only if the stored value matches it. `getNoticeState`'s call site passes this comparison instead of a bare boolean presence check.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:run`
- Type checking passes: `npm run lint`
- Linting passes: `npm run lint`

#### Manual Verification:

- Clicking Yes on a short-timebox session dismisses the dialog and the notice reappears on the next cycle's schedule, not immediately and not never
- Clicking Yes while offline (or against a broken action) shows the inline error, keeps the dialog open, and a retry succeeds once connectivity is restored
- Keyboard flow (Tab/Shift+Tab wrap, Escape) from the existing test suite still behaves identically after the Yes button gains pending/error states

---

## Phase 5: Test Coverage

### Overview

Update the tests that assumed Yes and No were identical, add coverage for the new pure logic and Server Action, and extend the e2e suite to prove at least two extension cycles plus RLS on the new table — keeping the repo at its enforced ≥80% threshold.

### Changes Required:

#### 1. Update now-invalid identical-behavior unit tests

**File**: `__tests__/dashboard/SessionExpiryNotice.test.tsx`

**Intent**: The existing "Yes dismisses the modal and sets the responded cookie" and "No dismisses the modal and sets the responded cookie" tests (lines 123-141) assert identical behavior for both buttons; they must be replaced with tests that assert Yes calls the extend path (mocked) and only No takes the plain-dismiss path. Add cases for: cycle-keyed cookie no longer suppressing a later cycle's notice, and the inline error/retry state after a failed extend.

**Contract**: Mirror the existing `vi.mock`-free, real-`document.cookie`, `vi.useFakeTimers()` style already used in this file. Mock the Server Action the same way `LoginForm.test.tsx`/`SignupForm.test.tsx` mock `login`/`signup` (`vi.hoisted` + `vi.mock("react", ...)` swap of `useActionState`).

#### 2. Unit tests for the extend-session action's pure expiry math

**File**: `__tests__/actions/session.test.ts` (new)

**Intent**: Test the pure "compute next effective expiry from current effective expiry" calculation in isolation from the live Supabase call, following research.md's noted convention that no Server Action here is unit-tested via a real network call — only its extractable pure logic.

**Contract**: Cover: extension from base expiry only (no prior row), extension from an already-extended expiry (compounds from the latest `extended_until`, not from `Date.now()`), and the boundary where current time is already past the naive base expiry but an unexpired extension still applies.

#### 3. E2E: multi-cycle extension

**File**: `e2e/session-expiry.spec.ts`

**Intent**: Extend the existing `"real session expiry (short timebox)"` describe block (or add a sibling test within it) to prove two full extension cycles: sign up, wait for the first notice, click Yes, assert the dialog closes and the expiry moved out, wait for the *second* notice on the new schedule, click Yes again, and assert continued access past the original (un-extended) expiry. Also add a case proving No/non-response still expires exactly as scheduled (extends the existing single-cycle test's assertions rather than duplicating setup).

**Contract**: Reuses `decodeAuthCookie`/`sessionStartedAtMs`/the `supabase-test` short-timebox harness already in this file (`beforeAll`/`afterAll` backend swap). Uses `test.setTimeout` generous enough for two ~30s cycles (existing single-cycle test already needs 75s).

#### 4. E2E: `session_extensions` RLS

**File**: `e2e/session-expiry.spec.ts`

**Intent**: Prove `session_extensions` is scoped by RLS the same way `applications` is, reusing the two-user pattern from `e2e/login.spec.ts:76-126` and this file's own `"RLS after session restoration"` block.

**Contract**: Two admin-created users, one row seeded per user in `session_extensions`, querying via each user's own access token must return only that user's row.

### Success Criteria:

#### Automated Verification:

- `npm run test:run` passes with coverage ≥80% lines/statements/functions/branches
- `npm run test:e2e` passes, including the new multi-cycle and RLS tests

#### Manual Verification:

- Coverage report (`npm run test:coverage`) shows `app/actions/session.ts` and the modified dashboard files are not silently excluded

---

## Phase 6: CI Workflow Split

### Overview

Split the existing single `e2e` job into independent `unit-tests` and `e2e-tests` jobs so a unit failure doesn't block e2e results and vice versa, without changing the underlying test harness.

### Changes Required:

#### 1. Split jobs in the tracked workflow

**File**: `../.github/workflows/playwright.yml` (repository root, relative to `nextjoblog/`)

**Intent**: Add a `unit-tests` job (checkout, Node 22 + npm cache, `npm ci`, `npm run test:run`) alongside the existing job (renamed `e2e-tests`, unchanged internals: Supabase CLI 2.117.0, `supabase start`, `supabase db reset`, Chromium install, `npm run test:e2e`, report upload). Both jobs run in parallel; the e2e job's own Playwright config keeps its existing single-worker constraint internally.

**Contract**: Preserve `working-directory: nextjoblog`, the npm cache path, and every existing e2e step exactly. Do not introduce `npm run test:unit` (not defined in `package.json`) — use the existing `npm run test:run`. Do not move the workflow file out of the repository root's `.github/workflows/`.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is valid (e.g. `actionlint` if available, or a push/PR trigger runs both jobs successfully in GitHub Actions)
- Both `unit-tests` and `e2e-tests` jobs appear and complete independently on the next push

#### Manual Verification:

- A deliberately broken unit test fails only `unit-tests`, leaving `e2e-tests` to run and report on its own

---

## Testing Strategy

### Unit Tests:

- Cycle-keyed cookie comparison (`hasRespondedCookie` against a given cycle's expiry, not just presence)
- Yes vs. No divergence in `SessionExpiryNoticeDialog`/`useSessionExpiryNotice`
- Inline error + retry state after a failed extend
- Pure expiry-extension math in `app/actions/session.ts` (compounding from current effective expiry, not `Date.now()`)
- Extension-aware effective-expiry computation in `layout.tsx`'s helper (base vs. extended, whichever is later)

### Integration Tests:

- Two-cycle extension end-to-end against the short-timebox Supabase project
- No/non-response still expires exactly on schedule after the production `timebox` removal (app-enforced sign-out, not GoTrue's)
- `session_extensions` RLS scoping (two users, admin-seeded rows)

### Manual Testing Steps:

1. Sign up on the short-timebox e2e stack, wait for the day-28-equivalent notice, click Yes, confirm the dialog closes and does not reappear until the new cycle's threshold
2. Click Yes a second time on that new cycle's notice and confirm a third cycle is scheduled
3. On a separate session, click No and confirm the session ends exactly at the original expiry (app-enforced sign-out to `/login`)
4. Simulate a network failure during an extend attempt and confirm the inline error appears with a working retry, and the original expiry still applies until retried successfully

## Performance Considerations

The one new DB read added to `app/dashboard/layout.tsx` runs once per dashboard navigation/render, not per request — `proxy.ts` remains DB-free by design (research.md's locked decision), so this does not add a database round-trip to every route.

## Migration Notes

As with Story 0.3's own `timebox` enablement, the hosted/production Supabase project's `timebox` setting is configured separately from `supabase/config.toml` (which only governs the local CLI stack) and must be removed manually in the hosted dashboard as a deliberate post-deploy step, not part of this plan's automated changes — flipping it retroactively on a live project immediately re-imposes a ceiling on already-issued sessions.

## References

- Related research: `context/changes/extend-session-via-stay-loggen-in/research.md`
- Prior story: `context/changes/stay-logged-in-across-browser-sessions/plan.md`, `context/changes/stay-logged-in-across-browser-sessions/research.md`
- RLS convention: `supabase/migrations/20260902082510_create_tables.sql`, `supabase/migrations/20260902082511_create_rls_policies.sql`
- Server Action convention: `app/actions/auth.ts:1-135`
- Layout auth-check limitation and recommended page/leaf-component pattern: `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1408`
- Two-user RLS e2e pattern: `e2e/login.spec.ts:76-126`
- Short-timebox e2e harness: `e2e/session-expiry.spec.ts:182-246`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: `session_extensions` Table and RLS

#### Automated

- [x] 1.1 Migration applies cleanly against local `supabase/` project — d06a847
- [x] 1.2 Mirrored migration applies cleanly against `supabase-test/` project — d06a847
- [x] 1.3 Mirrored migration file is byte-identical to the primary migration — d06a847

#### Manual

- [x] 1.4 `supabase start` boots locally with `timebox` removed and a fresh login still succeeds — d06a847

### Phase 2: Extend-Session Server Action

#### Automated

- [x] 2.1 Type checking passes
- [x] 2.2 Unit tests for the action's pure expiry-math helper pass

#### Manual

- [ ] 2.3 Calling the action against a local session inserts/updates the expected row

### Phase 3: Application-Managed Expiry and Enforced Sign-Out via Dashboard DAL

#### Automated

- [x] 3.1 Unit tests for the extension-aware expiry helper pass
- [x] 3.2 Type checking passes

#### Manual

- [x] 3.3 Letting effective expiry pass without extending redirects to `/login`
- [x] 3.4 Extending once and reaching only the original expiry does not sign the user out

### Phase 4: Client Wiring — Distinct Yes Handler, Cycle-Keyed Cookie, Error UX

#### Automated

- [ ] 4.1 Unit tests pass
- [ ] 4.2 Type checking passes
- [ ] 4.3 Linting passes

#### Manual

- [ ] 4.4 Yes dismisses and the notice reappears on the next cycle's schedule
- [ ] 4.5 Failed extend shows inline error with working retry
- [ ] 4.6 Existing keyboard flow (Tab/Shift+Tab/Escape) still behaves identically

### Phase 5: Test Coverage

#### Automated

- [ ] 5.1 `npm run test:run` passes with coverage ≥80%
- [ ] 5.2 `npm run test:e2e` passes, including new multi-cycle and RLS tests

#### Manual

- [ ] 5.3 Coverage report confirms new/modified files are not silently excluded

### Phase 6: CI Workflow Split

#### Automated

- [ ] 6.1 Workflow YAML valid; both jobs appear and complete independently

#### Manual

- [ ] 6.2 A broken unit test fails only `unit-tests`, `e2e-tests` still runs independently
