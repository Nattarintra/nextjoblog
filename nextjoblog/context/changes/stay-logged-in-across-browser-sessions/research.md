---
date: 2026-09-10T00:00:00+02:00
researcher: Natta
git_commit: 3b6c9f43d429a2cfe614851cc4cbd5877d857b32
branch: feat/stay-logged-in-access-browser-session
repository: nextjoblog
topic: "Stay logged in across browser sessions (30-day session persistence, day-28 expiry notice)"
tags: [research, codebase, auth, supabase, session, proxy, cookies]
status: complete
last_updated: 2026-09-10
last_updated_by: Natta
---

# Research: Stay logged in across browser sessions

**Date**: 2026-09-10
**Researcher**: Natta
**Git Commit**: 3b6c9f43d429a2cfe614851cc4cbd5877d857b32
**Branch**: feat/stay-logged-in-access-browser-session
**Repository**: nextjoblog

## Research Question

How should NextJobLog implement 30-day login session persistence across browser restarts, plus a day-28 "session expiring soon" notice (GitHub issue #5 / "Story 0.3"), building on the already-implemented signup/login stories, so that:

- A logged-in user stays logged in for up to 30 days after closing the browser, without re-entering credentials
- At day 28 (2 days before expiry), the app shows a notice that the session is expiring soon and offers a choice to stay logged in — this story covers only the notice and the default (unanswered/"No") outcome; the actual extension action is Story 0.3b
- A session older than 30 days, with no extension granted, is treated as logged out
- A missing/invalid/corrupted session is treated as logged out (never an error screen)
- RLS still scopes every query to the restored user, exactly as with a fresh login

**Correction (2026-09-10, Natta):** the session length was originally decided as 2 days on first draft; it was corrected the same day to **30 days**, with the expiry notice at day 28. Everywhere below that references "2-day"/"48h" reflects the superseded figure — see the note at the end of §2 for the corrected recommendation. The day-28 notice requirement is new relative to the original research pass below and has **not** been investigated yet (no findings on where/how to surface it) — flagged as an open gap rather than guessed at.

## Summary

The repo already has the two building blocks this story needs to sit on top of: `lib/supabase/server.ts` (a per-request Supabase server client backed by `@supabase/ssr` cookies) and `proxy.ts` (Next.js 16's renamed `middleware.js`, running `supabase.auth.getClaims()` on every request to keep the session cookie fresh). **Neither currently enforces or even config a session lifetime** — the `@supabase/ssr` cookie defaults to a 400-day `Max-Age`, and Supabase's own JWT/refresh-token settings in `supabase/config.toml` have no expiry beyond the 1‑hour access-token TTL. The 30-day requirement has to be met primarily through Supabase Auth's own **session timebox**, a commented-out `[auth.sessions]` block already sitting in `supabase/config.toml:270-275` — this is a first-class GoTrue feature designed exactly for this AC, not something to hand-roll with custom cookie/JWT logic (which the Next.js docs' own "Session Management" guide treats as a fallback for apps _without_ an auth library). The day-28 "expiring soon" notice, however, is **not** covered by `timebox` and has no existing scaffolding in the repo — it needs its own mechanism (see §2) that this research pass has only scoped, not fully answered.

There is no dashboard route yet, no logout action, and no route-guard/redirect-when-unauthenticated logic anywhere (that's explicitly slated for a later story, #6 / Story 0.4, which is documented as depending on _this_ story). Test/architecture conventions from the two prior auth stories (signup, login) are well established and should be extended, not reinvented. No coverage tooling exists yet in this repo at all — the "80% test coverage" requirement will need a coverage runner added, since `vitest.config.mts` has no `coverage` block and no `@vitest/coverage-*` package is installed.

## Detailed Findings

### 1. Session-refresh scaffolding already in place

- **`proxy.ts`** (repo root, 43 lines) — Next.js 16 renamed `middleware.js` → `proxy.js`/`proxy.ts` ([middleware.md doc](node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md) confirms this is not optional, the old convention is deprecated). Current implementation:
  - [proxy.ts:7-32](proxy.ts#L7-L32) builds an inline `createServerClient` reading/writing cookies from the `NextRequest`/`NextResponse` pair (no shared helper — self-contained, confirmed by both sub-agent explorations).
  - [proxy.ts:34](proxy.ts#L34) calls `await supabase.auth.getClaims()` — this both verifies the JWT (locally, via Supabase's asymmetric JWT signing, no network round-trip for verification) **and** triggers a refresh-token exchange + cookie rewrite when the access token is expired. This is the mechanism that currently keeps a session alive indefinitely across requests.
  - `config.matcher` at [proxy.ts:39-42](proxy.ts#L39-L42) runs on effectively every route (excludes only `_next/static`, `_next/image`, `favicon.ico`) — no route-guard/redirect logic exists here yet, by design (see §4).
- **`lib/supabase/server.ts`** — [lib/supabase/server.ts:1-27](lib/supabase/server.ts#L1-L27), the per-request Server Component/Action client, structurally identical cookie wiring to `proxy.ts` but reading from `next/headers` `cookies()` instead of the request object. Reused by both `signup` and `login` server actions in `app/actions/auth.ts`.
- **No browser-side Supabase client exists** (`grep -rn "createBrowserClient"` across the repo returns nothing) — everything so far is server-only, consistent with Server Actions + Server Components only.

### 2. Where the 30-day expiry must actually be enforced

- `supabase/config.toml:163-164`: `jwt_expiry = 3600` — the **access token** (JWT) lives 1 hour; this is unrelated to the "session" the AC talks about, since `getClaims()` silently refreshes it via the refresh token.
- `supabase/config.toml:169-173`: refresh-token rotation is already `enable_refresh_token_rotation = true` with a 10s reuse-interval grace window — refresh tokens themselves have **no configured expiry**, they're valid until rotated/revoked.
- **`supabase/config.toml:270-275` is the key finding**:
  ```
  # Configure logged in session timeouts.
  # [auth.sessions]
  # Force log out after the specified duration.
  # timebox = "24h"
  # Force log out if the user has been inactive longer than the specified duration.
  # inactivity_timeout = "8h"
  ```
  This is GoTrue's built-in, server-side session-lifetime feature — uncommenting `[auth.sessions]` with `timebox = "720h"` (30 days; Go's `time.ParseDuration` used by GoTrue has no native "days" unit, so this must be expressed in hours — needs confirming against GoTrue's actual config parser during planning, since `720h` assumes no DST/calendar-day subtlety) makes Supabase Auth itself invalidate the refresh token 30 days after login, independent of any cookie `Max-Age` the client holds. This is the authoritative, spec-correct way to implement "session's 30-day validity period" — it satisfies the AC ("treated as logged out" after 30 days with no extension) at the identity-provider level, so a stolen/replayed cookie past 30 days is rejected by Supabase itself, not just by client-side logic. `inactivity_timeout` is a distinct, separate knob (not requested by the AC — the story is explicit that base session = 30 days flat from login, not an inactivity window) and should be left commented out/unset unless a future story asks for it.
  **Day-28 notice — not covered by `timebox` alone:** GoTrue's `timebox` only enforces the hard cutoff; it has no built-in "N days before expiry" signal. Surfacing the day-28 notice will need the app to independently know the session's `created_at`/expiry (available from the JWT claims returned by `getClaims()`, or computed client-side as `created_at + 30d`) and compare it against "now" on load/poll to decide whether to show the notice. Where that check should live (proxy.ts optimistic check vs. a client-side timer vs. a Server Component check on dashboard load) is unresearched — flagged as an open question below, not a decision made here.
- **Cookie-level `Max-Age` is not a substitute.** `@supabase/ssr`'s `DEFAULT_COOKIE_OPTIONS` ([node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11](node_modules/@supabase/ssr/dist/main/utils/constants.js#L4-L11)) sets `maxAge: 400 * 24 * 60 * 60` (400 days — the browser-enforced cap per Chrome's cookie-lifetime policy) and `httpOnly: false`. Neither `proxy.ts` nor `lib/supabase/server.ts` currently overrides this. Two implications for the plan:
  1. Without the `[auth.sessions] timebox` server-side setting, the cookie would happily keep getting refreshed forever — the AC would not be met at all by cookie config alone.
  2. `httpOnly: false` is the `@supabase/ssr` default because the library supports apps with a browser client; since this app is server-only today, there's no functional need for JS to read the cookie — worth flagging as a hardening opportunity (not blocking, but relevant to the epic's data-security NFR) when the plan touches cookie options.
- **Corrupted/invalid/expired session handling**: `@supabase/auth-js` exposes `AuthSessionMissingError` (already imported indirectly via `isAuthApiError` in `app/actions/auth.ts`) for exactly the "no session" case. `getClaims()` returning no claims/an error should be treated as "no session" → fall through to showing the login page, never an error boundary. No existing code currently branches on this (verified via `grep -rn "AuthSessionMissingError\|getClaims\|refreshSession\|getSession\b"` — only the one call site in `proxy.ts:34`).

### 3. What is explicitly NOT this story's job (already decided elsewhere)

- **Story 0.4 (route guard, GitHub issue #6)** is documented as depending on _this_ story: `context/archive/2026-09-07-log-in-an-existing-account/research.md:153` notes 0.4 "depends on both 0.2 (a login system must exist) and 0.3/stay-logged-in (the guard must check _restored_ session state, not just a state set by a fresh login)." → **Do not add `/dashboard` redirect-if-unauthenticated logic in this story's plan** — that's 0.4's scope. This story's job is making the _session itself_ durable and correctly bounded; consuming it to gate routes is separate work already sequenced after this one.
- **Story 0.3b** (the actual "Yes, extend by 30 more days" action behind the day-28 notice, and its 60-day math) is explicitly out of scope per the story brief itself — this story ships the flat 30-day base session and the day-28 notice's display/default-outcome only, not the extension action.
- **A "remember me" opt-out** is explicitly out of scope per the story brief — sessions always persist for the full 30-day window, unconditionally.
- No dashboard route exists yet (`find app -iname "*dashboard*"` → empty); `signup`/`login` both already call `redirect("/dashboard")` on success ([app/actions/auth.ts:88](app/actions/auth.ts#L88), [:134](app/actions/auth.ts#L134)), so that route is a pre-existing stub target, not something this story needs to create from scratch, though a minimal placeholder may be needed for e2e verification.

### 4. Conventions this story should follow for consistency

**Server Actions** (`app/actions/auth.ts`): `'use server'` file directive, discriminated-union `*FormState` types, `redirect()` called unconditionally _after_ the try/catch block — never inside it (both prior stories' reviews independently flagged that `redirect()` throws `NEXT_REDIRECT` internally and gets swallowed if called inside a `catch`).

**Component split** (from signup, reused by login): `page.tsx` (Server Component — fonts/layout only) → `Form.tsx` (Client Component, `'use client'`, `useActionState`) → `Fields.tsx` (inputs) → `Alert.tsx` (error display, `data-testid="*-alert"`) → shared `styles.ts` (e.g. `authInputClassName`) and `AuthLogo.tsx`, imported cross-feature from `app/signup/` into `app/login/` rather than duplicated. Any new UI this story needs (if a session-expired notice is in scope) should follow the same Server/Client split and reuse `app/signup/styles.ts`/`AuthLogo.tsx`.

**Testing**:

- Unit (Vitest + `@testing-library/react`, jsdom): `__tests__/<feature>/<Component>.test.tsx`, mirroring `app/<feature>/`. `useActionState` is mocked via `vi.hoisted` + `vi.mock("react", ...)`; the Server Action itself is a bare `vi.fn()` — never actually invoked in unit tests. `next/link` is mocked to a plain `<a>`. `vitest.config.mts:5-10` scopes to `__tests__/**/*.test.{ts,tsx}`, jsdom environment — **no coverage config exists** (no `coverage` block, no `@vitest/coverage-v8`/`istanbul` in devDependencies, no `test:coverage` npm script). Meeting an 80% coverage target will require adding a coverage provider and threshold config, not just writing tests.
- **`proxy.ts` and `lib/supabase/server.ts` cannot be unit-tested with Vitest** (both depend on Next.js request lifecycle / `next/headers`) — this was explicitly called out in the signup story's testing strategy. Any session-timebox/expiry logic that lives in `proxy.ts` must be verified through Playwright e2e, not Vitest.
- E2E (Playwright, **real local Supabase, nothing mocked**): `e2e/<feature>.spec.ts`, `test.describe.configure({ mode: "default" })` to avoid parallel-worker races against shared seeded fixtures, `beforeAll` seeding via the real UI with try/catch tolerance for reruns, assertions via `getByLabel`/`getByRole`/`getByTestId`/URL regex. `e2e/login.spec.ts:76-126` already has a real two-user RLS-isolation test against `applications` — this story's RLS-after-restore AC should follow the same real-Supabase pattern rather than mocking. Testing the 30-day expiry (and the day-28 notice threshold) will need either `context.addCookies`/direct cookie tampering to simulate an aged/corrupted session, or a much shorter `timebox` value in a test-only Supabase config, since Playwright cannot realistically wait 30 days. Whatever value is chosen for the test config, the day-28-of-30 ratio (i.e. "2 days before expiry", not a hardcoded day number) should be preserved so the test still exercises the real relative timing, not an unrelated stand-in.
- `playwright.config.ts:3-19` — `testDir: "./e2e"`, `webServer` auto-starts `npm run dev`, `baseURL: "http://localhost:3000"`.

### 5. Lessons from prior reviews directly applicable here

- Keep the plan and the implementation in sync when `supabase/config.toml` changes mid-work — the signup story's impl-review flagged an undocumented `config.toml` edit as a finding; this story will almost certainly need to edit `config.toml` (`[auth.sessions]`) and must document that change in the plan up front, plus note the corresponding **remote Supabase project dashboard** setting (session timebox is also configurable per-project in the Supabase dashboard, not just local `config.toml` — the plan should call out that local config and hosted config are two separate places to set this, and only local `config.toml` is version-controlled here).
- Don't mark e2e success criteria "done" without an actual CI/local run — flagged twice in prior impl-reviews.
- An e2e assertion on a redirect/URL alone is insufficient — assert the actual underlying invariant (here: cookie/session state and RLS-scoped query results after restore), not just that the page didn't show a login form.

## Code References

- `proxy.ts:1-43` — session-refresh proxy (Next.js 16 `proxy.js`), no expiry/timebox logic yet
- `lib/supabase/server.ts:1-27` — server-side Supabase client factory (Server Components/Actions)
- `app/actions/auth.ts:88` and `:134` — existing `redirect("/dashboard")` targets from signup/login
- `supabase/config.toml:163-173` — `jwt_expiry`, refresh-token rotation settings
- `supabase/config.toml:270-275` — commented-out `[auth.sessions]` `timebox`/`inactivity_timeout` block (the mechanism this story should enable)
- `node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11` — `DEFAULT_COOKIE_OPTIONS` (400-day maxAge, `httpOnly: false`)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md` — confirms `middleware.js` → `proxy.js` rename in this Next.js version
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` (§ Session Management, § Optimistic checks with Proxy) — Next.js's own guidance to prefer an auth library's built-in session management (i.e. Supabase's own timebox) over hand-rolled JWT/cookie session logic, and to keep Proxy checks "optimistic" (cookie-only, no DB round-trip)
- `__tests__/login/LoginForm.test.tsx`, `__tests__/signup/SignupForm.test.tsx`, `__tests__/signup/password-validation.test.ts` — unit test conventions to mirror
- `e2e/login.spec.ts:76-126`, `e2e/signup.spec.ts` — e2e conventions, including the existing real-Supabase two-user RLS test to mirror for the "RLS still scopes after restore" NFR
- `vitest.config.mts:5-10`, `playwright.config.ts:3-19`, `package.json` scripts — no coverage tooling currently configured

## Architecture Insights

- This codebase deliberately keeps session logic thin and delegates to Supabase Auth's own primitives (`getClaims()`, refresh-token rotation) rather than the hand-rolled JWT/cookie approach the generic Next.js docs describe for apps without an auth library — consistent with the Next.js docs' own recommendation to prefer an auth library's built-in session management when one is available.
- `proxy.ts` is kept deliberately "optimistic" (cookie/claims-only, no DB query) per Next.js's Proxy guidance — this story should preserve that property; the 30-day boundary is enforced by Supabase Auth itself (server-side, via `timebox`), not by adding a database check inside `proxy.ts`. Whether the day-28 notice check can also stay "optimistic" in `proxy.ts`, or needs to live elsewhere, is unresolved (see Open Questions).
- The existing component-split (`page.tsx` / `Form.tsx` / `Fields.tsx` / `Alert.tsx` / shared `styles.ts`) is a small, consistent Single-Responsibility pattern already validated across two stories — extending it (rather than introducing a new pattern) is both the SOLID-aligned and the reviewer-expected choice.
- No coverage tooling exists yet anywhere in the repo — introducing one (e.g. `@vitest/coverage-v8` + a `coverage` block in `vitest.config.mts` with an 80% threshold) is itself in scope for this story if the 80%-coverage requirement is to be objectively checkable, since no prior story set this up.

## Historical Context (from prior changes)

- `context/archive/2026-09-07-log-in-an-existing-account/research.md` — origin of the `proxy.ts` design and the explicit note that Story 0.4 (route guard) depends on this story restoring session state correctly first.
- `context/archive/2026-09-07-log-in-an-existing-account/plan.md` and `reviews/impl-review.md` — `setAll(cookiesToSet, headers)` cookie-forwarding detail (the `Cache-Control: private, no-store` header must be forwarded in `proxy.ts`'s response) and the `redirect()`-outside-try/catch pitfall.
- `context/changes/sign-up-for-a-new-account/research.md` and `plan.md` — component-split conventions (`Form`/`Fields`/`Alert`/`styles.ts`), confirmation that Vitest cannot exercise `proxy.ts`/`lib/supabase/server.ts`, and the `config.toml`-changes-must-be-documented lesson from `reviews/impl-review.md`.

## Related Research

- `context/archive/2026-09-07-log-in-an-existing-account/research.md` (Story 0.2 — Log In to an Existing Account)
- `context/changes/sign-up-for-a-new-account/research.md` (Story 0.1 — Sign Up for a New Account)

## Open Questions

- ~~Should `[auth.sessions] timebox` be set to exactly `"720h"`...~~ **Resolved (2026-09-11, Natta):** `timebox = "720h"`. GoTrue's config parser is Go's `time.ParseDuration`, whose grammar only has `ns`/`us`/`ms`/`s`/`m`/`h` — no day unit — so `30 × 24 = 720h` is the correct, unambiguous way to express a flat 30-day duration; no calendar/DST subtlety applies since this is a pure elapsed-time window, not a calendar-date boundary.
- ~~Local `config.toml` vs. the hosted Supabase project dashboard...~~ **Resolved (2026-09-11, Natta):** yes, there is a real hosted Supabase project — confirmed via `.env.local`'s active `NEXT_PUBLIC_SUPABASE_URL` — behind a production deploy on Vercel (nextjoblog.vercel.app) that auto-deploys on merge to `main`. This means editing local `supabase/config.toml`'s `[auth.sessions]` block is **not sufficient on its own** — the plan must also apply the same `timebox = "720h"` to the hosted project (via the Supabase dashboard's Authentication → Sessions settings, or `supabase config push`/Management API) as an explicit, separate deployment step, since `config.toml` only governs the local CLI dev stack and there's no existing CI/deploy automation in this repo (`.github/` has no Supabase-config-push step) that would propagate it automatically.
  **Sequencing decision (2026-09-11, Natta): option 1 — deploy the code first, flip the hosted-dashboard `timebox` setting as a separate, deliberate step afterward.** Rationale: `timebox` is evaluated by GoTrue against each session's `created_at` retroactively, so enabling it on the live project immediately logs out any *already-logged-in* user whose session already exceeds 30 days — with no chance for them to see the day-28 notice, since that only fires for sessions currently between day 28–30. Deploying code first means the enforcement flip is a controlled, separate action rather than an accidental side effect of the merge landing, so the mass-logout-of-stale-sessions moment (accepted as low-blast-radius for this app) can be timed and watched deliberately rather than happening silently mid-deploy.
- ~~How should the 30-day-expiry e2e test simulate the passage of 30 days...~~ **Resolved (2026-09-11, Natta): two different mechanisms for two different ACs.**
  - The **"corrupted/invalid session → treated as logged out" edge case** uses **cookie/token tampering** (Playwright's `context.addCookies` with a missing/garbled/expired-looking cookie) — this only needs to prove the app's own reaction to a bad cookie, not Supabase's real enforcement.
  - The **"session genuinely expires after 30 days" happy-path/edge case** uses **a much shorter `timebox` in a dedicated local test config** (e.g. `timebox = "10s"`), run against the local Supabase CLI stack (`supabase start`) rather than the hosted project — this actually exercises real GoTrue enforcement, just compressed in time, which cookie-tampering alone would not prove. The day-28-of-30 notice-threshold test should scale proportionally against this same shortened local window (e.g. if using `timebox = "10s"`, the notice would need to fire at roughly the 2/3-of-window mark to preserve the "2 days before a 30-day expiry" ratio) — exact proportional value to be worked out at planning time once the notice mechanism itself (open question below) is decided.
- ~~Does "treated as logged out" for an expired/corrupted session require actively clearing the stale cookies...~~ **Resolved (2026-09-11, Natta):** yes, actively clear the cookie once a session is confirmed past its 30-day expiry with no extension granted (the "No"/silent-non-response edge case) — but this does **not** need a separate branch for "user clicked No" vs. "user never responded." Those two outcomes are indistinguishable and don't need to be: if the user had said "Yes" at the day-28 notice, Story 0.3b would extend the session *before* day 30, so it would never reach this expired state at all. The mere fact that a session is found past its 30-day mark already proves no extension happened, regardless of which of the two non-extension paths led there. So the rule is a single, unconditional check: whenever `getClaims()`/the expiry check confirms a session is genuinely past 30 days (not merely corrupted/missing — see below), clear its cookie at that point. **Distinguish from the "corrupted/invalid" edge case above**, where there may be no valid cookie shape to even confirm belongs to an expired session in the first place — clearing applies specifically to the "we know this was a real session and it has now expired" case, not to malformed/garbage cookie values generally (those can simply be left for the browser to ignore going forward, per the earlier discussion, since there's nothing meaningful to identify and clear).
- ~~**New, not yet researched:** where should the day-28 "expiring soon" notice live...~~ **Resolved (2026-09-11, Natta):** shown as a popup modal, triggered while the user is actively using the app, any time from **day 28 through day 30** (not strictly day 28 only) — so a user who wasn't active on day 28 but opens the app on day 29 or day 30 still sees the notice; someone who only opens the app again on day 31+ simply finds the session expired per the edge-case AC, no popup shown. **Once the user has responded (Yes or No/dismissed) within the day 28–30 window, the popup must not reappear on subsequent visits/reloads during that same window** — this means the app needs to persist a "already responded" flag for the current session (not just render the modal from a stateless expiry-window check each time), checked before deciding whether to show it again.
  This requires **client-side awareness of the session's expiry time**, checked while the app sits open — concretely: the session's `created_at`/expiry made available to the client (e.g. via a claim from `getClaims()`, passed from a Server Component into a Client Component), a client-side timer/interval comparing "now" against that expiry to decide whether to render the modal, and some persisted per-session "user already responded" state (candidates to weigh at planning: a cookie/localStorage flag scoped to the session, or — cleaner but more work — a flag stored server-side against the session itself so it survives across devices/tabs rather than being purely browser-local). **This is new client-side session-awareness that doesn't exist anywhere in this codebase yet** — `grep -rn "createBrowserClient"` found zero results, confirming no client-side Supabase usage exists today; this story is the first to introduce it. The popup-modal UI itself also has no precedent — existing `Alert` components (`LoginAlert.tsx`, `SignupAlerts.tsx`) are inline form-error displays, not standalone dismissible modals, so a new modal component needs to be built, not reused.
- ~~**New, not yet researched:** what does "the notice... offers the choice to stay logged in" require from this story specifically...~~ **Resolved (2026-09-11, Natta):** keep it simple — the modal just has two buttons, **Yes** and **No**. This story renders both and owns the "No"/dismiss path (does nothing; session proceeds to expire on schedule per the edge-case AC, and marks the "already responded" flag from the item above so the popup doesn't reappear). "Yes"'s actual extension behavior belongs to Story 0.3b — this story should not implement what clicking Yes *does* beyond marking it as responded, only render the button so 0.3b can wire its handler in without redesigning the modal.
