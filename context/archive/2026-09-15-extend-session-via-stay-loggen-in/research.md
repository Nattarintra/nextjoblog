---
date: 2026-09-15T08:40:05+00:00
researcher: Natta
git_commit: d6a2861b8b8c1095c8e9ae11f667dead48fcad3a
branch: feat/extend-session-via-stay-logged-in
repository: nextjoblog
topic: "Extend sessions through stay-logged-in confirmations (Story 0.3b)"
tags: [research, codebase, auth, supabase, session, gotrue, timebox, proxy, server-action]
status: complete
last_updated: 2026-09-17
last_updated_by: Natta
last_updated_note: "Added CI research for unit-test and Playwright e2e job requirements"
---

# Research: Extend sessions through stay-logged-in confirmations

**Date**: 2026-09-15T08:40:05+00:00
**Researcher**: Natta
**Git Commit**: d6a2861b8b8c1095c8e9ae11f667dead48fcad3a
**Branch**: feat/extend-session-via-stay-logged-in
**Repository**: nextjoblog

## Research Question

How should NextJobLog implement the "Yes, stay logged in" extension action behind the day-28–30 notice already built in Story 0.3, so that clicking "Yes" pushes the session's expiry 30 days past its *current* expiry (not 30 days from the click), repeating indefinitely with no cap, while "No"/non-response lets that cycle's session expire exactly as scheduled — given that Supabase's `[auth.sessions] timebox` is anchored to the JWT's `amr[0].timestamp` (the original login time) and cannot be moved forward by any documented Supabase client/admin API short of a full credential re-authentication?

## Summary

Story 0.3 already shipped the full notice UI (`app/dashboard/SessionExpiryNotice.tsx` and its supporting modules), a `proxy.ts` branch that clears cookies once GoTrue reports `session_expired`, and a `sessionExpiresAt` computation in `app/dashboard/layout.tsx` derived from `amr[0].timestamp + 30 days`. Today, **both the "Yes" and "No" buttons in `SessionExpiryNoticeDialog.tsx` call the exact same `onDismiss` handler** — clicking either one just sets a `session_expiry_responded` cookie and hides the dialog. No server action exists yet, and no distinction between "Yes" and "No" exists anywhere in the code. This story's entire job is to give "Yes" a real, distinct effect.

The central architectural finding, confirmed with high confidence by dedicated investigation of the `@supabase/auth-js` SDK source and official Supabase docs: **there is no supported Supabase-native way to bump the timebox anchor (`amr[0].timestamp` / GoTrue's internal `not_after`) without a full credential re-authentication.** `refreshSession()` mints a new access token but reuses the same `session_id` and leaves `amr` untouched; the admin API (`GoTrueAdminApi.js`) has no session-timing endpoint at all; and GoTrue's own docs explicitly describe `timebox` as a fixed window from session creation, distinct from the refresh-dependent `inactivity_timeout`. This means the AC's "extend by 30 days from current expiry, no re-login required" cannot be implemented by asking GoTrue to move its own clock — it requires an **app-layer override**, layered on top of GoTrue's enforcement, not a replacement for it.

The natural shape, consistent with this repo's existing RLS conventions (`supabase/migrations/*_create_rls_policies.sql`'s `auth.uid() = user_id` pattern used by `applications`, `cv_documents`, etc.): a new `session_extensions` table keyed by the JWT's stable `session_id` claim (confirmed stable across refreshes), storing `user_id` (FK to `auth.users`, RLS-scoped) and `extended_until timestamptz`. A "Yes" server action inserts/updates a row with `extended_until = current_expiry + 30 days`. The expiry-check logic (today computed statically in `app/dashboard/layout.tsx` from `amr[0].timestamp + 30d`, and separately re-checked by `proxy.ts` against GoTrue's own `session_expired` error) must use the application-managed expiry based on the original 30-day cycle plus the latest extension, and must keep re-checking this on every subsequent cycle, since the requirement is uncapped/recurring. This is a deliberate, documented departure from `proxy.ts`'s currently "optimistic, DB-free" architecture (flagged explicitly in Story 0.3's research as a property worth preserving) — the plan must call this out rather than slip it in silently, and should weigh whether the DB check belongs in `proxy.ts` itself (every request) or only in the dashboard layout's server-computed `sessionExpiresAt` (once per navigation), given `proxy.ts`'s config.matcher runs on nearly every route.

The repository already has a tracked Playwright workflow at the actual Git root (`/Users/natta/Desktop/Nextjs/.github/workflows/playwright.yml`); `nextjoblog/` is the application subdirectory. The workflow is therefore not missing or misplaced. Its remaining CI work for this story is to split the existing single E2E job and align its commands with the repository's actual npm scripts and short-timebox Supabase harness.

## Detailed Findings

### 1. Current "Yes"/"No" implementation — the exact gap this story fills

- **`app/dashboard/SessionExpiryNoticeDialog.tsx`** — both buttons call the same handler:
  ```tsx
  <button ref={noButtonRef} type="button" className={styles.noButton} onClick={onDismiss}>No</button>
  <button ref={yesButtonRef} type="button" className={styles.yesButton} onClick={onDismiss}>Yes</button>
  ```
  `onDismiss` comes from `useSessionExpiryNotice` (`app/dashboard/useSessionExpiryNotice.ts:37-42`): it only calls `setRespondedCookie(sessionExpiresAt)` and `setShow(false)`. **No server call happens today on either button.**
- **`app/dashboard/session-expiry-notice.ts`** — the pure logic module, already split out beyond what Story 0.3's plan described:
  - `DEFAULT_NOTICE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000` (2 days)
  - `getNoticeState(now, sessionExpiresAt, hasResponded, noticeWindowMs)` → `boolean`, independently unit-tested
  - `getNextNoticeCheckDelay(...)` → schedules the next `setTimeout` check, capped at `MAX_TIMER_DELAY_MS = 24h` per timer (re-arms in ≤24h chunks — this is the fix for the 24.8-day `setTimeout` cap mentioned in the recent commit `798ae1c`)
- **`app/dashboard/useSessionExpiryNotice.ts`** — the `responded` cookie is named `session_expiry_responded`, written via `document.cookie` with `expires` pinned to `sessionExpiresAt` (so it survives browser restarts but not the session's own life).
- **`app/dashboard/layout.tsx`** (`DashboardLayout`, 54 lines) — computes `sessionExpiresAt` server-side:
  ```ts
  const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
  function getSessionLifetimeMs(): number {
    const configuredLifetimeMs = Number(process.env.SESSION_TIMEBOX_MS);
    return Number.isFinite(configuredLifetimeMs) && configuredLifetimeMs > 0
      ? configuredLifetimeMs : DEFAULT_SESSION_LIFETIME_MS;
  }
  function computeSessionExpiresAt(claims, sessionLifetimeMs): number | undefined {
    const firstAmrEntry = claims?.amr?.[0];
    if (!firstAmrEntry || typeof firstAmrEntry === "string") return undefined;
    return firstAmrEntry.timestamp * 1000 + sessionLifetimeMs;
  }
  ```
  Called via `const { data } = await supabase.auth.getClaims(); const sessionExpiresAt = computeSessionExpiresAt(data?.claims, sessionLifetimeMs);` — **no DB read today**, purely derived from the JWT claim + a constant lifetime. `noticeWindowMs` passed to the notice component is `sessionLifetimeMs / 15` (2/30 ratio, preserved even under the shortened e2e `SESSION_TIMEBOX_MS`).
  **This is the exact function this story must change**: today `sessionExpiresAt` is a pure function of `amr[0].timestamp` (fixed at login). Once extensions exist, it must become `max(amr[0].timestamp + 30d, latestExtension.extendedUntil ?? 0)` — which requires a DB read this layout doesn't do today.

### 2. Why GoTrue's timebox cannot be bumped server-side (the core architectural constraint)

- `refreshSession()`/`_refreshSession()` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3198-3260`, hitting `POST /token?grant_type=refresh_token`) returns a new access token but **does not change `amr`** — the JWT claims JSDoc example (`GoTrueClient.js:5296-5333`) shows `amr` as the array of *original* authentication events; refresh does not append to it. `session_id` (`GoTrueClient.js:5320`) is also unchanged across refreshes — GoTrue reuses the same session row.
- `GoTrueAdminApi.js` exposes `signOut`, `inviteUserByEmail`, `generateLink`, `createUser`, `listUsers`, `getUserById`, `updateUserById`, `deleteUser` — **none touch session timing**. `updateUserById` only patches user attributes; `generateLink` mints action links that, if followed, create a brand-new session (new `amr` entry) rather than extending the existing one.
- `reauthenticate()` (`GoTrueClient.js:2179-2205`) is unrelated — it's an OTP-nonce gate for secure password changes, not a session-timing primitive.
- Grepping the entire SDK for `not_after`, `refreshed_at`, `timebox` returns **zero matches** — these are purely server-side (GoTrue's Postgres `auth.sessions` table) and invisible to `auth-js` entirely.
- Official Supabase docs (`supabase.com/docs/guides/auth/sessions`) describe `timebox` as terminating a session "after a fixed amount of time," explicitly contrasted with `inactivity_timeout` ("terminates sessions that haven't been refreshed within the timeout duration") — confirming the fixed-anchor model. Docs also note: "the actual duration of a session is the configured timeout plus the JWT expiration time," and settings changes are enforced "whenever a session is refreshed next" — i.e., checked against the fixed anchor at refresh time, not reset by it.
- `auth.sessions` does have `not_after`/`refreshed_at` columns server-side, but there is no documented RPC/API to write them from application code, and the `auth` schema is explicitly reserved for GoTrue-managed data — direct writes would be unsupported and could break under a GoTrue upgrade.
- **Conclusion (high confidence)**: the only way to move `amr[0].timestamp` forward is a fresh credential-based auth event — which would also prompt for credentials, defeating this story's one-click "Yes" UX. **The feature requires an app-layer extension-tracking table**, not a GoTrue-native mechanism.

### 3. Existing RLS/migration convention to extend for the new table

- `supabase/migrations/20260902082510_create_tables.sql` and `20260902082511_create_rls_policies.sql` establish the shape every user-scoped table in this app follows:
  ```sql
  user_id uuid not null references auth.users(id) on delete cascade,
  ...
  create policy ... for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  ```
  A new `session_extensions` (or similarly named) table should follow this exact shape: `user_id` FK + `auth.uid() = user_id` RLS, plus `session_id` (the stable claim) and `extended_until timestamptz`.
- `supabase/migrations/README.md` documents the `supabase-test/supabase/migrations/` mirror as **manually maintained** with an explicit drift-risk warning — confirmed via `diff -rq` that the two migration directories are currently byte-identical. **Any new migration for `session_extensions` must be copied to both `supabase/migrations/` and `supabase-test/supabase/migrations/`.**

### 4. `proxy.ts` — where the expiry check currently lives, and the "optimistic" constraint

- Current full logic (`proxy.ts:34-54`):
  ```ts
  const { error } = await supabase.auth.getClaims();
  if (isAuthApiError(error) && error.code === "session_expired") {
    request.cookies.getAll()
      .filter(({ name }) => isChunkLike(name, authCookieStorageKey))
      .forEach(({ name }) => response.cookies.delete(name));
  }
  ```
  This purely delegates to GoTrue's own `session_expired` determination and has **no awareness of application extensions**. The production decision is to omit the fixed `timebox`, so GoTrue will not impose the original 30-day ceiling before NextJobLog's application-managed expiry. `proxy.ts` must still handle genuine Supabase expiry errors, while the application expiry check must clear/sign out the session when the user does not confirm. This makes the application-managed expiry the product source of truth and leaves the remaining design question focused on where that check should run.
- `proxy.ts`'s `config.matcher` (`:57-61`) runs on nearly every route — any DB read added here for extension-checking runs on every request, a real perf/architecture tradeoff versus keeping the extension check only in `app/dashboard/layout.tsx` (once per dashboard navigation) as today's `sessionExpiresAt` computation already does.

### 5. Server Action conventions to follow for the new "extend session" action

- `app/actions/auth.ts` establishes the pattern: `"use server"` directive, exported `*FormState` discriminated union (`SignupFormState`, `LoginFormState`), functions shaped `async (_state, formData) => FormState` matching `useActionState`, specific-error-code checks via `isAuthApiError`/`error.code` before a generic `{ error: "unknown", message }` fallback with `console.error`, and `redirect()` called **after** the try/catch, never inside it (`app/actions/auth.ts:88`, `:134`) since `redirect()`'s internal `NEXT_REDIRECT` throw would otherwise be swallowed by a surrounding `catch`.
- A new "extend session" action doesn't need `redirect()` (it dismisses a modal, not navigates), but should mirror the discriminated-union error-state shape for the Error Handling AC ("user sees an error and the original expiry still applies" on failure) — e.g. `ExtendSessionState = undefined | { ok: true; extendedUntil: number } | { error: "unknown"; message: string }`.
- No server action in this repo is unit-tested directly today — `login`/`signup` are only ever mocked as `vi.fn()` in component tests (`__tests__/login/LoginForm.test.tsx:13-15`, `__tests__/signup/SignupForm.test.tsx:14`) via the `vi.hoisted` + `vi.mock("react", ...)` pattern that swaps `useActionState`. Real behavior is exercised only through Playwright e2e against the live local Supabase stack. **The new extend-session action should follow this same split**: mocked in any dialog/component unit test, real-behavior-tested in a new e2e spec.

### 6. Testing conventions and coverage tooling to extend

- `vitest.config.mts` — 80% thresholds on lines/statements/functions/branches, `coverage.exclude: ['proxy.ts', 'lib/supabase/server.ts']`. **A new server action file (e.g. `app/actions/session.ts`) is NOT excluded by default** and will need unit tests (of its pure/mockable logic, not the live Supabase call) to keep thresholds passing, unless deliberately added to `exclude` with justification mirroring `proxy.ts`'s.
- `__tests__/dashboard/SessionExpiryNotice.test.tsx` (200 lines) is the closest precedent: separates pure-function tests (`getNoticeState`) from component tests using `vi.useFakeTimers()`/`act(() => vi.advanceTimersByTime(...))` and direct `document.cookie` manipulation (no mocking library). Existing tests already assert "Yes" dismisses + sets cookie (`:123-131`) and "No" dismisses + sets cookie (`:133-141`) as *identical* behavior — **these two tests will need to change** once Yes/No diverge, and new tests must cover Yes triggering the extension action while No does not.
- `e2e/session-expiry.spec.ts` (247 lines) is the direct precedent to extend:
  - Helpers already available: `authCookieStorageKey()`, `isAuthSessionCookie()`, `decodeAuthCookie()`, `accessTokenLifetimeSeconds()`, `sessionStartedAtMs()` (reads `amr[0].timestamp`).
  - The `"real session expiry (short timebox)"` describe block (`:182-246`) already swaps in `supabase-test/` (a fully separate local Supabase project, `timebox = "30s"`, `jwt_expiry = 5`) via `execSync("supabase stop")` / `execSync("supabase start --workdir supabase-test")` in `beforeAll`/`afterAll`, single-worker (`test.describe.configure({ mode: "default" })` + `playwright.config.ts`'s `workers: 1`), since it swaps the whole backend. **A new "extend repeatedly, indefinitely" e2e test almost certainly needs this same short-timebox harness** — the AC requires proving multiple extension cycles (at least 2, to prove "repeats indefinitely" isn't a one-shot special case), which needs compressed time exactly like the existing expiry test.
  - The "RLS after session restoration" describe block (`:111-180`) shows the pattern for a new `session_extensions` table's own RLS test (two users, admin-seeded rows, anon-key client, assert scoping) — directly reusable for verifying the new table's RLS.
- **`package.json`'s `test:e2e` script** (`scripts/run-e2e.mjs`) derives Supabase credentials from `supabase status -o env` — this only works against a **running local stack**, consistent with the user's note that Playwright itself can't run on their capped-at-macOS-13 machine (no compatible Chromium binary) but `supabase status`/Docker can still run locally if needed for other purposes; actual Playwright execution must happen in CI.
- **`.github/workflows/playwright.yml` is already present and tracked at the Git repository root** (`../.github/workflows/playwright.yml` when viewed from `nextjoblog/`). The workflow's `defaults.run.working-directory: nextjoblog` (`:15-17`) and npm cache path `nextjoblog/package-lock.json` (`:23-28`) are correct because the app is a subdirectory of the repository root. Moving it to `nextjoblog/.github/workflows/` would make it invisible to GitHub for this repository.
- The existing workflow has one `e2e` job (`:9-59`). It already checks out the repository, installs Node 22 and dependencies, installs Supabase CLI 2.117.0, starts/resets the normal local stack, installs Chromium with system dependencies, runs `npm run test:e2e`, and uploads the report. The required split should preserve this E2E setup and add a separate unit job.
- The proposed `unit-tests` command `npm run test:unit` does **not** currently exist. `package.json` exposes `test`, `test:run`, `test:coverage`, and `test:e2e` (`package.json:5-13`); `npm run test:run` is the existing non-watch Vitest command suitable for CI. Either the workflow must use `npm run test:run`, or implementation must first add a `test:unit` alias.
- The E2E command (`scripts/run-e2e.mjs:3-23`) requires a running local Supabase stack and obtains `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` from `supabase status -o env`, passing them to the Playwright child process as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. No GitHub secrets are needed for this local-stack test.
- `playwright.config.ts:21-28` starts Next.js automatically through `webServer` with `SESSION_TIMEBOX_MS=30000`; the Playwright process environment is inherited by that server. The workflow therefore does not need a separate “start Next.js app” shell step—`npm run test:e2e` triggers it through Playwright.
- The current workflow starts the normal stack (`playwright.yml:41-45`), while `e2e/session-expiry.spec.ts:193-203` stops that stack and starts `supabase-test` for the short-timebox describe block, then restores the normal stack. This is intentional because the suite contains both normal-stack tests and real-expiry tests. A direct workflow step that starts only `supabase-test` would break the earlier normal-stack tests unless the suite is split or the harness is redesigned.
- `playwright.config.ts:7-14` forces one worker and enables CI retries; this is necessary because the expiry spec swaps shared Supabase containers and ports. The two GitHub jobs can run in parallel with each other, but the E2E tests themselves must remain single-worker.

### 7. Next.js project structure conventions (per user's requested reference)

- The repo already follows the App Router convention the user linked (`app/` with route-colocated `page.tsx`/`layout.tsx`, feature-colocated components like `app/dashboard/SessionExpiryNotice.tsx` living next to the route that uses them, shared logic split into plain `.ts` modules like `app/dashboard/session-expiry-notice.ts` next to the component that consumes it). Any new "extend session" server action should live in `app/actions/` (alongside `auth.ts`, e.g. `app/actions/session.ts`), consistent with the existing single `app/actions/` directory for all Server Actions rather than colocating actions under `app/dashboard/`.
- Tailwind usage is via existing shared style modules (`app/signup/styles.ts`, reused by `login`) — any new UI change (e.g. a loading/error state on the "Yes" button, or an error toast) should reuse this pattern rather than introducing new inline Tailwind classes or a new styling convention.

## Code References

- `app/dashboard/SessionExpiryNoticeDialog.tsx` — Yes/No buttons currently both call `onDismiss`; this is the wiring point for a distinct "Yes" handler
- `app/dashboard/useSessionExpiryNotice.ts:1-58` — `dismiss()`/cookie logic; needs a new path for "extend" vs. plain "dismiss"
- `app/dashboard/session-expiry-notice.ts:1-21` — `getNoticeState`/`getNextNoticeCheckDelay` pure functions, precedent for keeping new expiry-with-extension math pure/testable
- `app/dashboard/layout.tsx:1-54` — `computeSessionExpiresAt`; must become extension-aware, likely requiring a DB read this file doesn't do today
- `proxy.ts:34-54` — GoTrue `session_expired` cookie-clearing branch; the fallback for genuine Supabase expiry while the application-managed extension controls the product expiry
- `lib/supabase/server.ts:1-28` — `createServerSupabaseClient()`, what any new server action/DB read would use
- `app/actions/auth.ts:1-135` — Server Action conventions (`*FormState`, error-code branching, `redirect()`-after-try/catch)
- `supabase/config.toml:271-275` — `[auth.sessions] timebox = "720h"`, the explicit local fixed ceiling to remove so application-managed extensions can continue beyond the original 30-day cycle
- `supabase/migrations/20260902082510_create_tables.sql`, `20260902082511_create_rls_policies.sql` — `user_id`/`auth.uid() = user_id` RLS convention for the new `session_extensions` table
- `supabase/migrations/README.md` — manual-mirror-to-`supabase-test/` drift-risk warning
- `__tests__/dashboard/SessionExpiryNotice.test.tsx:123-141` — existing tests asserting Yes/No are currently identical; will need updating once they diverge
- `e2e/session-expiry.spec.ts:182-246` — short-timebox harness (`supabase-test/`, `execSync`, single-worker) to extend for multi-cycle extension e2e coverage
- `e2e/session-expiry.spec.ts:111-180` — RLS-after-restoration pattern, reusable for the new table's RLS test
- `e2e/login.spec.ts:76-126` — canonical two-user RLS test pattern
- `vitest.config.mts:1-22` — 80% coverage thresholds, `proxy.ts`/`lib/supabase/server.ts` exclusions
- `scripts/run-e2e.mjs` — local credential derivation via `supabase status -o env`, the pattern any new GitHub Actions workflow should mirror server-side
- `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3198-3260,5296-5333` — `refreshSession`/`getClaims` JWT shape, confirming `amr`/`session_id` are unchanged by refresh
- `node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.js` — full admin API surface, confirmed to have no session-timing endpoint

## Architecture Insights

- This app has consistently delegated session mechanics to Supabase Auth's own primitives rather than hand-rolling JWT/cookie logic (Story 0.3's research and plan both note this explicitly). This story is the first case where that delegation hits a real ceiling: **GoTrue's `timebox` has no supported extension primitive**, forcing a genuine architectural addition (an app-owned table) rather than a pure "flip another GoTrue config flag" change like Story 0.3's `timebox` enablement was. The plan should name this explicitly rather than let it read as "just another Supabase setting."
- `proxy.ts` was deliberately kept "optimistic" (cookie/claims-only, no DB round-trip) through Story 0.3. This story's extension-tracking necessarily requires a DB read somewhere in the expiry-determination path (either in `proxy.ts` on every request, or scoped to `app/dashboard/layout.tsx` on dashboard navigation only, matching where `sessionExpiresAt` is already computed today). This is a real tradeoff the plan must decide and document, not silently break.
- GoTrue's `timebox` is a **hard, fixed ceiling from original login** that no client/admin API can move. The chosen approach is to omit the production `timebox`, use Supabase's documented default with no fixed maximum, and let the app-layer `extended_until` value enforce the 30-day confirmation cycles. This preserves the no-re-authentication requirement while making the application responsible for reliably signing out users whose current cycle expires.
- The existing component-split and Server Action conventions (from Stories 0.1–0.3) are stable, validated patterns — the new extend-session action and any button-level UI change should extend them, not introduce a new pattern.

## Historical Context (from prior changes)

- `context/changes/stay-logged-in-across-browser-sessions/research.md` — origin of the `amr[0].timestamp` discovery, the notice-modal UX decisions (day-28–30 window, cookie-based "responded" flag, Yes/No both just dismiss for *this* story, extension deferred to "Story 0.3b"), and the explicit note that this story (0.3b) was always expected to wire the Yes handler without redesigning the modal.
- `context/changes/stay-logged-in-across-browser-sessions/plan.md` — Phase 4's contract explicitly scoped Yes/No to "both currently just set the `responded` cookie and dismiss ... this component only exposes the button for [Story 0.3b] to wire a handler into later" — confirming today's identical-behavior buttons are intentional, not a bug, and exactly this story's job to change.
- `context/changes/stay-logged-in-across-browser-sessions/reviews/impl-review.md` — F3 notes `npm run test:e2e` needed local-credential derivation fixed (now in `scripts/run-e2e.mjs`); relevant since this story's new e2e tests will run through the same script locally and need their own GitHub Actions equivalent for CI, which doesn't exist yet.
- `context/archive/2026-09-07-log-in-an-existing-account/research.md` — origin of the `redirect()`-outside-try/catch convention and the note that Story 0.4 (route guard) depends on session-restoration behavior being correct — not directly this story's concern, but confirms `/dashboard` still has no auth guard, so any new server action triggered from the dashboard should not assume route-level auth enforcement exists.

## Related Research

- `context/changes/stay-logged-in-across-browser-sessions/research.md` (Story 0.3 — Stay Logged In Across Browser Sessions)
- `context/changes/stay-logged-in-across-browser-sessions/plan.md` and `reviews/impl-review.md` (Story 0.3 implementation)
- `context/archive/2026-09-07-log-in-an-existing-account/research.md` (Story 0.2 — Log In to an Existing Account)
- `context/changes/sign-up-for-a-new-account/research.md` (Story 0.1 — Sign Up for a New Account)

## Current Decision Status

- **The production `timebox` should be omitted.** Supabase documents that sessions last indefinitely by default when no positive `timebox` is configured. This repository currently overrides that default with `timebox = "720h"` (30 days) in `supabase/config.toml`; that explicit setting must be removed for extensions to continue beyond the original 30-day period. A long finite value such as `87600h` is rejected as unnecessarily long and is not part of the design.
- **The product rule remains separate from the Supabase setting.** The 30-day confirmation cycle will be managed by NextJobLog: clicking **Yes** extends the current application expiry by 30 days, while **No** or non-response allows that expiry to end. Supabase will provide the underlying authenticated session without imposing a fixed maximum lifetime; the application must enforce its own expiry and sign the user out when that expiry is reached.
- **The notice is shown once per expiry cycle.** The prompt is eligible only during the final two days of the current 30-day cycle (Days 28–30), and only when the user is active in the application. Once the prompt has been shown during that cycle, it must not reappear during the same cycle—even if the user does not click either button. A new prompt cycle begins only after a successful **Yes** extension, when the new expiry becomes the next cycle’s anchor. This requires tracking a cycle-specific `shown` state separately from the existing response cookie; otherwise a dismissed or unanswered prompt could be shown repeatedly while the user remains active.
- **Keep the short test timebox.** `supabase-test/supabase/config.toml` should retain its short `timebox` so automated tests can exercise expiry quickly. Tests for the application-managed extension behavior must account for the difference between the test stack and the production/local configuration.
- **Question 2 is locked: the database is the source of truth for extensions.** The "Yes" server action will update `session_extensions`; it will not write a new application-expiry cookie for `proxy.ts` to consume. The dashboard layout will read the updated `extended_until` value and derive the new `sessionExpiresAt`. After a successful extension, the client must refresh the server component tree (for example with `router.refresh()`) so the notice receives the new expiry. The existing client-side cycle state must be keyed to the cycle's expiry (rather than only checking whether `session_expiry_responded` exists), so the old cycle's cookie cannot suppress the next cycle. A separate cycle-specific `shown` state remains required if the implementation must distinguish "notice shown" from an explicit response.
- **The extension-check DB read is locked to `app/dashboard/layout.tsx`.** The layout will read the current user's `session_extensions` row during dashboard navigation/rendering and derive the application-managed `sessionExpiresAt` there. `proxy.ts` will remain DB-free and will continue handling only Supabase/GoTrue authentication state, preserving its existing optimistic request-path behavior. Dashboard-side client timing and server-side dashboard checks must handle the application expiry; extending this enforcement to every route is out of scope for this change and would require a separate protected-route decision.
- **The `session_extensions` schema is locked to the latest-expiry model.** Store one row per `session_id`, with `session_id` as the unique key/primary key, `user_id` as the RLS ownership key and foreign key to `auth.users`, and `extended_until` as the latest application-managed expiry (plus standard creation/update timestamps as appropriate). A successful Yes action will upsert the existing row rather than append extension history; each new expiry is calculated from the current effective expiry plus one session period.
- **The GitHub Actions workflow is locked to separate jobs.** The existing tracked workflow is at the actual Git root, `.github/workflows/playwright.yml`; because `nextjoblog/` is the app subdirectory, its `working-directory: nextjoblog` is intentional. The workflow will define independent `unit-tests` and `e2e-tests` jobs so failures are isolated and the jobs can run in parallel.
  - `unit-tests`: run `npm ci`, then `npm run test:run` (or add a `test:unit` alias before using that proposed name).
  - `e2e-tests`: retain the existing CLI setup, normal-stack startup/reset, Playwright browser installation, and `npm run test:e2e`. The test suite itself switches to `supabase-test/` for the short-timebox expiry block and restores the normal stack afterward (`e2e/session-expiry.spec.ts:193-203`).
  - Do not add a separate shell step to start Next.js: `playwright.config.ts:21-28` starts it automatically through Playwright's `webServer`, with `SESSION_TIMEBOX_MS=30000`.
  - The E2E job needs no hosted Supabase secrets; `scripts/run-e2e.mjs:3-23` derives the local URL, anon key, and service-role key from `supabase status -o env`.

Supabase references: [User sessions](https://supabase.com/docs/guides/auth/sessions) states that sessions last indefinitely by default, and the [local CLI configuration reference](https://supabase.com/docs/guides/local-development/cli/config#auth-sessionstimebox) lists `auth.sessions.timebox` with a default of `None`.

## Follow-up Research 2026-09-17: Existing CI and split-job design

### Repository and workflow location

The Git repository root is `/Users/natta/Desktop/Nextjs`, while the Next.js application is `/Users/natta/Desktop/Nextjs/nextjoblog`. The tracked workflow is `.github/workflows/playwright.yml` at the repository root. Its current `working-directory: nextjoblog` and `cache-dependency-path: nextjoblog/package-lock.json` are correct. The workflow must remain at the parent-level `.github/workflows/` path for GitHub to discover it.

### Exact split-job contract

The current workflow's single `e2e` job can be split without changing the test harness:

| Job | Required steps | Evidence |
| --- | --- | --- |
| `unit-tests` | checkout, Node 22/npm cache, `npm ci`, `npm run test:run` | `package.json:5-13` |
| `e2e-tests` | checkout, Node 22/npm cache, `npm ci`, Supabase CLI 2.117.0, `supabase start`, `supabase db reset`, `npx playwright install --with-deps chromium`, `npm run test:e2e`, upload report | `.github/workflows/playwright.yml:9-59` |

The name `npm run test:unit` is not currently executable: it is absent from `package.json`. This is the primary command mismatch. The safest workflow-only change is to use the existing `npm run test:run`; adding a `test:unit` alias is an optional naming change, not a prerequisite for running unit tests.

### Supabase and environment behavior

The workflow starts the normal `supabase/` project because the E2E suite begins with tests that expect that stack. The short-timebox project is deliberately switched inside `e2e/session-expiry.spec.ts`, where `beforeAll` runs `supabase stop` followed by `supabase start --workdir supabase-test`, and `afterAll` stops it and restarts the normal stack (`:193-203`). The test project uses `timebox = "30s"` (`supabase-test/supabase/config.toml:281-287`). Because both projects use shared ports, `playwright.config.ts:7-14` sets `workers: 1`; changing this to parallel E2E workers would race the backend swap.

`npm run test:e2e` does not read repository `.env.local` for CI credentials. Instead, `scripts/run-e2e.mjs:3-23` calls `supabase status -o env`, maps `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`, then launches Playwright with those values. `playwright.config.ts:21-28` launches the Next.js dev server automatically and sets `SESSION_TIMEBOX_MS=30000`, so a standalone `npm run dev` step would be redundant and potentially conflicting.

### Required workflow changes versus current file

1. Rename the existing `e2e` job to `e2e-tests` (or retain `e2e` if job naming is not important).
2. Add a `unit-tests` job using `npm run test:run`, not the currently absent `npm run test:unit`.
3. Keep `working-directory: nextjoblog`, the Node cache path, Supabase CLI setup, normal-stack startup/reset, Chromium installation, E2E command, and report path.
4. Keep the E2E job single-worker through the existing Playwright config; parallelize the two top-level jobs, not the shared-backend E2E specs.
5. Do not move the workflow into `nextjoblog/.github/workflows/` and do not start only `supabase-test/` at workflow level unless the test file's backend-switching harness is redesigned.

### Fresh verification

- `npm run test:run` currently passes: 5 test files and 31 tests, with coverage above the configured 80% thresholds. This confirms it is the executable unit-test command today; `npm run test:unit` remains undefined.
- `supabase status -o env` cannot be verified in this restricted local environment because the Supabase CLI attempted to write telemetry under `/Users/natta/.supabase` and received `EPERM`. This is an environment permission issue, not evidence that the workflow command is wrong; GitHub's Ubuntu runner still needs Docker and a writable CLI environment.
- The repository root is `/Users/natta/Desktop/Nextjs`, not the `nextjoblog` application directory. The existing workflow's parent-level location and `working-directory: nextjoblog` are therefore intentional and must be preserved.

## Open Questions
