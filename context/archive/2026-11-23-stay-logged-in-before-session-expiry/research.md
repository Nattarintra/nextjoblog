---
date: 2026-11-23T10:31:11+01:00
researcher: Natta
git_commit: a495d7d22c6748cf5bf61a7c83b1c424bbd180b7
branch: feat/stay-logged-in-before-session-expiry
repository: nextjoblog
topic: "Research stay-logged-in-before-session-expiry"
tags: [research, codebase, authentication, sessions, supabase, protected-routes, accessibility]
status: complete
last_updated: 2026-11-23
last_updated_by: Natta
last_updated_note: "Resolved the compare-and-set mechanism, cross-tab coordination, shared Dialog accessibility approach, and CI-only E2E verification strategy."
---

# Research: stay-logged-in-before-session-expiry

**Date**: 2026-11-23T10:31:11+01:00  
**Researcher**: Natta  
**Git Commit**: `a495d7d22c6748cf5bf61a7c83b1c424bbd180b7`  
**Branch**: `feat/stay-logged-in-before-session-expiry`  
**Repository**: `nextjoblog`

## Research Question

Explore the codebase and existing change context for `stay-logged-in-before-session-expiry`, identifying the current session-expiry architecture, reusable patterns, implementation gaps, and historical constraints before planning the change.

## Summary

The repository already contains the core application-owned expiry model and protected-route enforcement. Supabase claims provide the base expiry; `session_extensions.extended_until` can move the effective expiry forward; `getEffectiveSessionExpiry()` computes the maximum; and every protected leaf page calls `requireSession()` before rendering protected data.

The current implementation is not yet compliant with the active change. The most important correctness gap is concurrency: `extendSession()` reads the current expiry and unconditionally upserts `+30 days`, so two tabs or a double submission can extend the same cycle twice. The persistence layer needs a compare-and-set/conditional update against the expiry observed by the prompt.

The current prompt has only the basic timer, cookie dismissal, modal, and extension action. It lacks visibility rechecks, cross-tab coordination, date rendering, the designed success toast, the designed retry/failure state, focus restoration/backdrop dismissal, and the `reason=session_expired` login presentation. The existing `Dialog`, `Toast`, protected shell, and test patterns are suitable foundations.

## Detailed Findings

### Session and expiry architecture

- `lib/session/claims.ts:5-20,36-49` derives the base expiry from the first `amr` timestamp plus the configured session lifetime and validates `session_id`/`sub`.
- `lib/session/calculations.ts:3-15` defines effective expiry as `max(baseExpiresAt, extendedUntil)` and computes the next expiry by adding the configured lifetime.
- `lib/session/service.ts:17-61` calls Supabase `getClaims()`, reads the extension row, and returns `{ status: "authenticated", claims, effectiveExpiresAt }` or a typed unauthenticated/verification-failed result.
- `lib/auth/require-session.ts:30-52` is the authoritative application-expiry guard. It redirects when `isSessionExpired()` is true. `proxy.ts` remains an optimistic Supabase-auth check and does not query the application table (`proxy.ts:76-116`).
- Every protected leaf page calls `requireSession()` before protected data/rendering: `app/(protected)/dashboard/page.tsx:10-16`, `app/(protected)/applications/page.tsx:36-42`, `app/(protected)/applications/new/page.tsx:16-23`, and `app/(protected)/applications/[id]/page.tsx:21-32`.
- `app/(protected)/layout.tsx:30-47` passes effective expiry into the shared shell. This is the correct location for the prompt UI; the layout remains presentational rather than the authoritative guard.

### Persistence and extension action

- `supabase/migrations/20260917100000_create_session_extensions.sql:1-11` defines one row per `session_id` with `user_id`, `extended_until`, timestamps, and owner RLS (`auth.uid() = user_id`). The same migration exists in the short-timebox test project; `supabase/migrations/README.md:1-6` warns that the mirror is manual.
- `lib/session/extension-store.ts:22-45` reads `extended_until` by `session_id`; `:48-63` writes it with an unconditional upsert using `onConflict: "session_id"`.
- `app/actions/session.ts:37-69` correctly obtains authenticated claims on the server, does not accept a client-supplied replacement date, rejects an already expired effective session, and returns the server-calculated `extendedUntil`.
- The missing condition is at `app/actions/session.ts:45-67` / `lib/session/extension-store.ts:48-57`: there is no expected-expiry input, conditional update, transaction, or RPC. Concurrent requests can both read the same value and each add 30 days.
- The schema intentionally stores only the latest expiry, not an extension history. Prior research records this as the chosen one-row-per-session design (`context/archive/2026-09-15-extend-session-via-stay-loggen-in/research.md:153-182`).
- The canonical schema document omits `session_extensions` (`supabase/docs/nextjoblog-supabase-schema-en.md:14-30,219-249`), a known documentation gap from `context/archive/2026-10-15-log-out-of-the-app/research.md:207-225`.

### Prompt timing, state, and cross-tab behavior

- `app/(protected)/_components/useSessionExpiryNotice.ts:31-49` performs an initial check, schedules a timer, and keys the dismissal cookie to the exact expiry value. A new expiry therefore starts a new cycle.
- `app/(protected)/_components/session-expiry-notice.ts:4-11` centralizes the threshold calculation and caps timer scheduling at 24 hours.
- Existing tests cover threshold timing, bounded timer rearming, dismissal persistence, and a new-cycle expiry value (`__tests__/dashboard/SessionExpiryNotice.test.tsx:46-144`).
- No client implementation uses `visibilitychange`, `BroadcastChannel`, `storage`, `localStorage`, or `sessionStorage` for this feature. The active acceptance criteria therefore require new lifecycle and coordination code.
- The cookie should remain the durable per-cycle state; cross-tab messaging should only propagate an answer/close stale prompts, matching the decision in `change.md`.

### UI, accessibility, and reusable patterns

- `components/ui/Dialog.tsx:30-43` already supplies `role="dialog"`, `aria-modal`, labelled heading support, Escape handling, and focus trapping through `lib/hooks/use-dialog-keyboard-navigation.ts:11-37`.
- `SessionExpiryNoticeDialog.tsx:20-37` focuses an initial action and renders the current Yes/No prompt, but it lacks `aria-describedby`, backdrop dismissal, focus restoration, dates, relative timing, required labels, and the mobile bottom-sheet action ordering.
- `ProtectedAppShell.tsx:29-40` and `useShellModals.ts:3-16` prevent competing shell modals from stacking. `ProtectedAppShell` currently restores menu focus, not the previously focused element for the expiry prompt.
- `components/ui/Toast.tsx:10-31` and `PasswordUpdatedToast.tsx:20-51` establish the toast lifecycle, auto-dismiss, close control, and `role="status"` pattern. `__tests__/protected/PasswordUpdatedToast.test.tsx:28-75` is the closest test model.
- `useSessionExtension.ts:21-33` currently dismisses and refreshes after success, but does not surface a server-date confirmation toast. The toast must be created only from the returned `extendedUntil`, never an optimistic client date.
- Current error handling uses `role="alert"`, but the copy and controls do not match the design: there is no explicit `Try Again`, no unchanged end-date display, and the current generic Yes action remains in the failed state.

### Test coverage and CI verification

- `vitest.config.mts:10-34` already enables V8 coverage and enforces 80% minimum lines, statements, functions, and branches. It has stricter 90% thresholds for `lib/auth/**` and `lib/applications/**`; new session/UI code must not be silently excluded.
- `package.json:10-13,24-35` already provides `test:run`, `test:coverage`, `test:e2e`, and the V8/Playwright dependencies. The implementation should add tests without weakening these gates.
- `.github/workflows/playwright.yml:1-89` already runs unit tests and Playwright E2E as independent Ubuntu jobs. The E2E job starts Supabase, resets the database, runs database tests, installs Chromium, runs Playwright, and uploads the report.
- `playwright.config.ts:1-28` uses Desktop Chrome and CI retries. The repository’s established decision is that Ubuntu CI is authoritative because the development Mac is capped at macOS 13 and cannot run the required Playwright Chromium binary.
- Therefore local E2E execution is not a required verification step for this change. CI must cover the real Supabase RPC and browser flows; local changes should be validated with static inspection and, where appropriate, unit tests without attempting unsupported Chromium execution.
- Required unit cases include: CAS success/conflict mapping, threshold/timer behavior, `visibilitychange`, cookie cycle reset, BroadcastChannel/storage fallback, date formatting, error/retry state, Dialog ARIA/focus behavior, toast rendering, and expired-login messaging.
- Required E2E cases include: successful extension using the real RPC, stale/double-submit protection, multiple extension cycles, cross-tab prompt closure, RLS ownership, expired redirect with sanitized `next`, and the designed success/failure/expired-login screens.

### Expired-login flow

- `lib/auth/require-session.ts:47-49` detects an expired application-managed session and redirects through the session-expired handler.
- `app/api/auth/session-expired/route.ts:16-24` performs cleanup and preserves a sanitized `next` destination; `lib/auth/expired-session.ts:18-60` signs out with local scope and has bounded cleanup/error logging.
- Existing tests cover local cleanup, deep-link preservation, external `next` rejection, and cache headers (`__tests__/api/auth/session-expired.test.ts:1-104`, `e2e/session-expired-route.spec.ts:16-60`).
- The current redirect ends at `/login?next=...`, not `/login?reason=session_expired&next=...`. `app/login/page.tsx:14-23`, `app/login/LoginForm.tsx:15-56`, and `lib/auth/messages.ts:120-130` have no expired-session presentation branch.
- The change should add a generic informational message, preserve safe `next`, leave the email field empty, and avoid revealing account-specific information.

## Code References

- `app/actions/session.ts:32-73` — server extension action; server-derived expiry, but currently unconditional.
- `lib/session/extension-store.ts:18-64` — `session_extensions` repository adapter.
- `lib/session/service.ts:17-61` — effective expiry lookup.
- `lib/auth/require-session.ts:30-69` — protected route guard and expiry redirect.
- `app/(protected)/_components/useSessionExpiryNotice.ts:1-55` — prompt timer/cookie state.
- `app/(protected)/_components/SessionExpiryNoticeDialog.tsx:1-49` — current prompt UI.
- `app/(protected)/_components/useSessionExtension.ts:1-39` — client action integration.
- `components/ui/Dialog.tsx:1-52` — modal accessibility/focus primitive.
- `components/ui/Toast.tsx:1-39` and `app/(protected)/_components/PasswordUpdatedToast.tsx:1-61` — toast patterns.
- `supabase/migrations/20260917100000_create_session_extensions.sql:1-11` — table and RLS.
- `supabase/docs/nextjoblog-session-expiry-screens.html:549-606,729-737` — source design states and responsive/accessibility notes.
- `vitest.config.mts:10-34` — enforced coverage thresholds and exclusions.
- `.github/workflows/playwright.yml:1-89` — authoritative CI unit/E2E jobs and Ubuntu Chromium setup.
- `playwright.config.ts:1-28` — Desktop Chrome configuration, CI retries, and local server setup.

## Architecture Insights

- Keep application-expiry enforcement in `requireSession()` and preserve the database-free optimistic role of `proxy.ts`. “Middleware/requireSession” in the change should be interpreted as complete protected-route enforcement, not a new database query in `proxy.ts`.
- Keep `expires_at` as the domain/UI name and map it to `session_extensions.extended_until` in the persistence adapter; no schema rename is needed.
- The extension operation needs an atomic compare-and-set boundary. A read-then-unconditional-upsert is insufficient; a conditional update/RPC should return either the new expiry or a safe conflict/failure result.
- Put prompt state in the shared protected shell, preserve the cookie as durable cycle state, and add visibility/timer re-evaluation plus BroadcastChannel/storage fallback.
- Reuse existing dialog/toast/focus/test primitives, extending them only where the active acceptance criteria require described content, backdrop dismissal, and focus restoration.

## Historical Context (from prior changes)

- `context/archive/2026-09-15-extend-session-via-stay-loggen-in/research.md:27-33,153-182` explains why GoTrue’s original timebox cannot be moved and why the app-owned `session_extensions` row is the source of truth.
- `context/archive/2026-10-01-redirect-unauthenticated-users/research.md:90-107` establishes `requireSession()` as the authoritative DAL guard and the application-table/RLS pattern.
- `context/archive/2026-10-15-log-out-of-the-app/research.md:43-48,207-225` records that extension rows are intentionally not cleaned up on local logout and that schema documentation needs updating.
- `context/archive/2026-09-10-stay-logged-in-across-browser-sessions/research.md:36-69` documents the optimistic proxy boundary and the distinction between provider session expiry and the application’s “expiring soon” UI.
- `context/archive/2026-11-19-refresh-access-ui/research.md:53-119` and its plan establish the current shared Toast/Dialog direction and the protected-shell composition pattern.

## Related Research

- `context/archive/2026-09-15-extend-session-via-stay-loggen-in/research.md`
- `context/archive/2026-10-01-redirect-unauthenticated-users/research.md`
- `context/archive/2026-10-15-log-out-of-the-app/research.md`
- `context/archive/2026-11-19-refresh-access-ui/research.md`

## Open Questions

- **Resolved (2026-11-23):** Use a Supabase Postgres RPC for the compare-and-set update. The server action will send an opaque server-issued expiry token rather than a client-supplied date; the RPC will atomically update only when the stored expiry still matches the expected cycle value. This is supported on the Supabase Free plan because it uses the included Postgres database, not Edge Functions.
- **Resolved (2026-11-23):** Use `BroadcastChannel` to notify other open tabs when one tab answers the prompt; use a `storage` event fallback where it is unavailable. Other tabs close their stale prompt and do not submit another extension. The cookie remains the durable per-cycle state. If a stale request still reaches the server, the RPC compare-and-set rejects it safely and the client reconciles by closing/refetching rather than extending again.
- **Resolved (2026-11-23):** Extend the shared `Dialog` primitive backward-compatibly with optional `aria-describedby`, backdrop dismissal, and focus restoration. The expiry prompt will use the shared API, avoiding a one-off accessibility implementation while preserving existing dialog behavior by default.
- **Resolved (2026-11-23):** Require at least 80% Vitest coverage across lines, statements, functions, and branches, and run Supabase-backed Playwright E2E in GitHub Actions on Ubuntu. Local E2E is not required because macOS 13 cannot run the project’s Chromium binary.
