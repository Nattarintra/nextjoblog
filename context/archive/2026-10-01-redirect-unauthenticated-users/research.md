---
date: 2026-10-01T12:43:52+02:00
researcher: Natta
git_commit: d1f2639d3861739c503483419fdab56028a94bec
branch: feat/Redirect-Unauthenticated-Users-from-Protected-Pages
repository: nextjoblog
topic: "Redirect unauthenticated users from protected pages (Story 0.4, GitHub issue #6)"
tags: [research, codebase, auth, route-guard, proxy, open-redirect, session, next-param]
status: complete
last_updated: 2026-10-01
last_updated_by: Natta
---

# Research: Redirect unauthenticated users from protected pages

**Date**: 2026-10-01T12:43:52+02:00
**Researcher**: Natta
**Git Commit**: d1f2639d3861739c503483419fdab56028a94bec
**Branch**: feat/Redirect-Unauthenticated-Users-from-Protected-Pages
**Repository**: nextjoblog

## Research Question

How should NextJobLog (Next.js 16.3.4 App Router + Supabase SSR) implement Story 0.4: redirect logged-out users from protected pages to `/login`, carry the requested path + query through a validated `next` parameter, return them there after login (falling back to `/dashboard` for anything external or auth-related), render a fail-closed "We couldn't verify your session" screen with retry, and show a "not found" page for missing or not-owned records — while meeting SOLID / testability / a11y goals and keeping ≥80% test coverage. Wireframes: `supabase/docs/nextjoblog-mvp-screens.html:517-584` (screens 00.5 login-redirected, 00.6 session-check-failed, 00.7 not-found). Schema: `supabase/docs/Nextjoblog-supabase-schema.md`.

## Summary

Roughly half the plumbing exists, but **none of the guard is wired to `next`, and the one guard that exists is not fail-closed in the way the story demands.**

1. **Where the guard lives today:** only `app/dashboard/page.tsx` guards itself, via `getEffectiveSessionExpiry()`. "No session" and "session expired" both go to `/api/auth/session-expired`, which signs out and redirects to a bare `/login` — the originally requested URL is lost. `proxy.ts` never redirects; it only refreshes cookies.
2. **The session lookup collapses distinct failures.** `lib/session/service.ts:22-24` returns `undefined` for *any* `getClaims()` error, so a network/service failure (`AuthRetryableFetchError`) is indistinguishable from "no session". Today that path hits `/api/auth/session-expired`, which calls `signOut()`, so a transient outage **logs the user out**. The story wants a distinct "unable to verify" state with a retry, and it must not destroy the session. Separately, `lookup_error` is `throw`n (`app/dashboard/page.tsx:13-15`) and there is **no `error.tsx` anywhere in `app/`**, so the user sees Next's default error page, not the 00.6 screen.
3. **`login()` always redirects to `/dashboard`** (`app/actions/auth.ts:200`). The login page doesn't read `searchParams`, and `LoginForm` has no hidden `next` field. `signup()` likewise (`:138`) — the story only mandates login, so signup is an open question.
4. **None of the three wireframe screens exist** (return strip on login, session-error screen, not-found). No `not-found.tsx` exists, and no record routes (`/applications/[id]`) exist yet, so "deleted application → not found" can only be built and tested against a generic mechanism now.
5. **RLS is already in place** (`supabase/migrations/20260902082511_create_rls_policies.sql`) as `auth.uid() = user_id` on every table with `for all using … with check`. The NFR "only rows matching the user's user_id" is satisfied at the database layer; the app work is to make sure protected pages query through the **user-scoped anon client** (`createServerSupabaseClient`) and never a service-role client, and to add one test/E2E that proves a foreign user's row yields not-found.
6. **Next 16 doc guidance** (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`): Proxy = optimistic, cookie-only pre-filter; the authoritative check belongs in a Data Access Layer close to the data (React `cache`-memoized `verifySession()`), and **auth checks should not live only in layouts** (layouts don't re-render on navigation). The current `DashboardLayout` fetches expiry but doesn't guard, which is consistent with that — keep it so.

Recommended shape (detail in "Architecture Insights"): a pure `next`-path sanitizer in `lib/auth/`, a small pure "session state" classifier, a DAL `requireSession()` that redirects to `/login?next=…` (and renders the 00.6 UI on verification failure), an optimistic redirect in `proxy.ts` for the happy-path "no flash" requirement, and `login()` reading a hidden `next` field and passing it through the sanitizer.

## Detailed Findings

### 1. Current route guard behavior

- `app/dashboard/page.tsx:10-19` — the only guard. `lookup_error` → `throw`; no session or `isSessionExpired(...)` → `redirect("/api/auth/session-expired")`. Guard is inlined in the page; any new protected page (`/applications/[id]`) would have to copy it.
- `app/dashboard/layout.tsx:8-24` — reads `getEffectiveSessionExpiry()` to feed `SessionExpiryNotice`; does not redirect. Both layout and page call the same function, deduplicated by `cache()` (`lib/session/service.ts:57`).
- `app/api/auth/session-expired/route.ts:5-14` — `GET` handler: `signOut()` then `NextResponse.redirect(new URL("/login", request.url))`. This is a Route Handler (not a Server Component) on purpose, because cookies can only be cleared in a response context (see `__tests__/dashboard/page.test.tsx:36` "response-context logout handler"). **It drops any `next`** — to preserve deep links it must accept and forward a sanitized `next`, or the guard must stop routing "no session" through it (nothing to clear when there is no session; only a *confirmed expired* session needs cookie cleanup, and `proxy.ts:63-70` already clears those).
- `proxy.ts:15-79` — `getClaims()` on every request except static assets (`config.matcher`, `:76-78`). It **never redirects**. On `SupabaseConfigError` it **fails open** (`:21-35`, explicit comment) — it passes the request through, relying on Server Actions/Server Components to validate config independently. For a route guard this is acceptable *only if* the DAL layer fails closed, which it currently does by throwing (→ default error page) — that needs to become the 00.6 screen or a deliberate config-error state.
- `app/page.tsx` (`/`) is a public "under construction" page; there is no public/protected route list anywhere in code.

### 2. Session-state lookup (what the guard has to distinguish)

- `lib/session/service.ts:15-55` `fetchEffectiveSessionExpiry`:
  - `claimsError || !data?.claims` → `undefined` (**conflates** "no session", "corrupt token", "expired JWT", and "Supabase unreachable").
  - missing/invalid `amr`/`session_id` claims → `undefined`.
  - extension-store or other thrown error → `{ status: "lookup_error" }` (logged, not signed out).
  - success → `{ status: "authenticated", effectiveExpiresAt }`.
- `@supabase/auth-js@2.113.0` `getClaims` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`, `async getClaims`): with **no stored session** it returns `{ data: null, error: null }` — no error at all; with an expired/invalid JWT it returns an `AuthInvalidJwtError`; network failure during refresh surfaces as an `AuthError` (retryable fetch error); and `fetchJwk` can **throw a non-`AuthError`**, which `getClaims` rethrows. So a correct classifier needs three buckets, not two:
  - `unauthenticated`: `error == null && data == null`, or `AuthSessionMissingError`, or `AuthInvalidJwtError`/`session_expired` → redirect to login.
  - `verification_failed`: `isAuthRetryableFetchError`, any other `AuthError` with a 5xx/`status === 0`, or a thrown exception → render 00.6, **do not sign out, do not redirect**.
  - `authenticated`.
- `lib/session/calculations.ts` (`isSessionExpired`, `computeEffectiveSessionExpiresAt`) and `lib/session/claims.ts` are already pure and unit-tested (`__tests__/lib/*.test.ts`) — good SRP examples to mirror for the new classifier.
- The 30-day timebox / extension story (0.3, 0.3b) is already implemented: `effectiveExpiresAt` is computed from claims + `session_extensions` table, so "guard must check restored session state" (dependency on 0.3) is satisfied simply by reusing `getEffectiveSessionExpiry`, not by re-deriving expiry.

### 3. Login flow and `next`

- `app/login/page.tsx:34-42` — server component, takes no props, renders `<LoginForm />`. Next 16 `searchParams` is a `Promise` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:67-83`) and `PageProps<'/login'>` is globally typed.
- `app/login/LoginForm.tsx:21-54` — `useActionState(login, undefined)`; client component. `LoginFields` (`app/login/LoginFields.tsx:19`) renders `<form action={formAction}>` with `email`/`password` only — **no hidden `next` input**.
- `app/actions/auth.ts:141-201` `login()`: validates email shape, calls `signInWithPassword`, maps errors to a `LoginFormState` union, then `redirect("/dashboard")` **after** the `try/catch` (a deliberate convention — `redirect()` throws `NEXT_REDIRECT` and would be swallowed inside `catch`; prior reviews flagged this, see `context/changes/stay-logged-in-across-browser-sessions/research.md` §4). Keep that ordering: compute `redirectTarget` before the `try`, `redirect(redirectTarget)` after it.
- Existing tests: `__tests__/actions/auth.test.ts` (action behavior incl. redirect), `__tests__/login/LoginForm.test.tsx`; e2e `e2e/login.spec.ts` (seeds `login-seed@example.com` via signup, uses a service-role admin client).
- Wireframe 00.5 (`nextjoblog-mvp-screens.html:518-544`): title "Log In to Continue", subtitle "You need to be logged in to open this page.", plus a **return strip** "You'll return to the page you opened" with a human label ("An application's notes"). The label is derived content, not the raw URL; a pure `describeDestination(path)` (route → label, default "your dashboard"/no strip) keeps this open for extension and avoids echoing attacker-controlled text.
- The `/forgot-password` link exists (`LoginFields.tsx:49`) but **no such page exists** (`grep -rn "forgot-password" app` → only that link). `/reset-password` (named in the AC) also doesn't exist yet. The auth-path denylist should be defined as data now so the future pages are covered without code change.

### 4. `next` validation (open-redirect protection)

No validator exists. Requirements from the story, translated into testable rules for a pure function `resolvePostLoginPath(raw: string | string[] | null | undefined): string`:

- Accept only a single string starting with exactly one `/` (reject `//evil.com`, `https://…`, `javascript:`, empty, arrays, non-strings).
- Reject backslash tricks: browsers normalize `\` to `/`, so `/\evil.com` and `/%5Cevil.com` can become protocol-relative. Reject any `\`, tab/CR/LF/control characters (including percent-encoded forms after one decode).
- Parse with `new URL(raw, "http://internal.invalid")` and require `origin === "http://internal.invalid"` as a second, structural check — defense in depth rather than only a regex. Return `pathname + search` (+ `hash` is not sent to the server, so it's dropped).
- Compare the decoded pathname against an `AUTH_PATH_PREFIXES` constant (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/api/auth`) → fallback to `/dashboard`. Match on path segment boundary (`/login` and `/login/x`, not `/loginfoo`), and match case-insensitively after normalization.
- Fallback constant `DEFAULT_POST_LOGIN_PATH = "/dashboard"` (no magic string at call sites).
- Query string must survive intact (`/applications/123?tab=notes`). When the proxy builds `next`, it must `encodeURIComponent(pathname + search)` so `?tab=notes` isn't swallowed as a parameter of `/login`.
- Bound the length (e.g. 2,048 chars) so a crafted URL can't bloat cookies/headers/logs.
- Validate **twice**: when rendering the login page (so the return strip and hidden field never carry an unsafe value) and again inside the `login()` server action (the action is the trust boundary — hidden form fields are attacker-controlled).

### 5. Guard placement (Next 16 guidance applied)

Per `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1017-1033, 1121, 1131-1233, 1358`:

- **Proxy (optimistic):** cheap pre-filter on every route, no DB. The existing `getClaims()` call (`proxy.ts:61`) already provides claims-only verification, so adding "no claims on a protected path → `NextResponse.redirect('/login?next=…')`" costs nothing extra and delivers the AC's "immediately redirected, no flash of protected content" before any page renders. Must copy refreshed cookies from the working `response` onto the redirect response (the `setAll` closure at `proxy.ts:47-60` replaces `response`; a naive new `NextResponse.redirect` would drop refreshed tokens). Must **not** redirect on network failure (otherwise outage = sign-out loop) — only on a definite "unauthenticated" result, and let the DAL render 00.6 for the rest.
- **DAL (authoritative):** `requireSession()` (React `cache`) in `lib/auth/`, called at the top of each protected page / data function. Handles the full classification including the `session_extensions` expiry check and returns a typed result or redirects. This also gives record pages one place to get the authenticated user id.
- **Not in layouts only:** keep `DashboardLayout` presentational; don't rely on it for auth (it doesn't re-run on client navigations).
- Route grouping: Next's project-structure doc (`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`) supports route groups for organizing without affecting URLs. A `(protected)` group with a shared guard layout would let `/dashboard` and future `/applications/[id]` share one guard, but moving `app/dashboard` has test/e2e import-path implications (`@/app/dashboard/...` in `__tests__/dashboard/*`). Trade-off for planning: group move (clean, bigger diff) vs. keeping `app/dashboard` and adding a shared `requireSession()` call (smaller diff, relies on every page remembering to call it).
- **Public path list:** define once (`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/api/auth/*`) in a typed constant used by the proxy matcher logic; default-deny for everything else so a forgotten new route is protected, not exposed (OCP/fail-closed). The proxy `config.matcher` still has to keep excluding static assets.

### 6. Fail-closed session error (screen 00.6)

- Wireframe `nextjoblog-mvp-screens.html:546-568`: heading "We Couldn't Verify Your Session", explanatory subtext, 3 numbered steps, **Try Again** (primary) and **Go to Log In** (secondary), footnote "No application data was loaded".
- Retry semantics: "You'll stay on this page if it works" → retry must re-run the server check for the *same URL* without losing it. Candidate mechanisms: (a) a segment `error.tsx` client boundary using `unstable_retry` (added v16.2.0, per `error.md` changelog line 332) — needs a verified doc read of the exact prop name/behavior before planning; (b) a client component calling `router.refresh()`. Throwing a typed `SessionVerificationError` from the DAL and rendering 00.6 from an `error.tsx` is the lowest-coupling option (page code never branches on UI), but `error.tsx` boundaries also catch unrelated errors, so the boundary must check `error instanceof`/a serializable `digest`-safe marker — error classes don't survive the server→client boundary intact in production (only `digest`), so a marker approach needs design (e.g. render 00.6 directly from the DAL's returned state instead of throwing). **This is the main design risk to settle in planning.**
- Must not leak data: nothing from Supabase tables may be queried before the check passes — satisfied by running `requireSession()` first.
- Must not sign the user out on verification failure (today's behavior in the `lookup_error` → throw path doesn't sign out, but the `claimsError → undefined → /api/auth/session-expired` path **does**; classifier fix required — see §2).
- A11y for 00.6: `role="alert"` or focus management on mount for the heading, button semantics for retry, visible focus rings, numbered steps as an `<ol>` (the wireframe's `span.n` circles should be CSS counters/`<ol>` not manual digits for screen readers), warn colors with sufficient contrast (existing `--warning-*`/`--auth-*` tokens in `app/globals.css`).

### 7. Not-found for missing / non-owned records (screen 00.7)

- No `app/not-found.tsx` and no record routes exist. Next's `notFound()` (+ segment `not-found.tsx`) renders a 404 and is the mechanism; wireframe 00.7 shows "We can't find this application / It may have been deleted, or the link may be wrong." with **Go to Dashboard** and **View All Applications** buttons. `/applications` list doesn't exist yet — that link would 404; plan should either point it at `/dashboard` for now or gate it as a follow-up.
- Security requirement "no data from that record is returned": because RLS makes a non-owned row indistinguishable from a deleted one (`select … where id = $1` returns zero rows for both), the page must treat "zero rows" as `notFound()` and **must not** return 403 or different copy for "exists but not yours" (that would leak existence). Using `.maybeSingle()` on the anon, user-scoped client gives exactly this for free.
- The schema's `applications` table has `user_id` + `applications_owner` policy; the `session_extensions` migration (`supabase/migrations/20260917100000_create_session_extensions.sql`) is the existing precedent for a user-scoped store accessed through `createSupabaseSessionExtensionStore` (`lib/session/extension-store.ts`) — a repository-style abstraction taking an injected client, which is the pattern to copy for future record fetchers (DIP/testability).
- Since the record pages themselves are out of scope for this story, the deliverable is: a generic `not-found.tsx` matching 00.7, a documented pattern (`notFound()` on zero rows), and a test proving the pattern with a stub fetcher. A concrete `/applications/[id]` page would be speculative.

### 8. Test and coverage landscape

- Vitest 4.1.11 + jsdom; coverage already enforced at 80% for lines/statements/functions/branches (`vitest.config.mts:8-18`), v8 provider; `proxy.ts` and `lib/supabase/server.ts` are **excluded** from coverage (covered by Playwright e2e instead).
- Current baseline (`npx vitest run`, 2026-10-01): **16 files / 113 tests passing; 93.81% statements, 89.35% branches, 100% functions, 94.4% lines.** Lowest: `app/actions/auth.ts` 81.25% lines / 68.62% branches — and this story modifies `login()`, so adding branches there without tests could push the file toward the gate; new `next` branches must ship with tests.
- Because `proxy.ts` is coverage-excluded, any redirect logic added there is untested by the gate. To satisfy "≥80% covered" honestly, **extract the proxy decision into a pure function** (e.g. `decideRouteAccess({ pathname, search, authState }) → { action: 'allow' } | { action: 'redirect', location }`) in `lib/auth/`, unit-test it exhaustively, and keep `proxy.ts` as thin wiring covered by e2e.
- Test conventions to follow: `vi.hoisted` + `vi.mock("next/navigation", …)` for `redirect`/`notFound` (`__tests__/dashboard/page.test.tsx:1-20`); server-action tests mock `@/lib/supabase/server`; component tests with Testing Library + `user-event` (`__tests__/login/LoginForm.test.tsx`); e2e with Playwright using Supabase admin client for seeding (`e2e/login.spec.ts`), run through `scripts/run-e2e.mjs`.
- E2E cases to add: (a) logged-out `GET /dashboard` → lands on `/login?next=%2Fdashboard` with no dashboard content in the response (assert via `page.goto` + check the first navigation response is a redirect, e.g. `request.get(..., {maxRedirects: 0})` status 307 and `Location`), (b) deep link with query → login → back at same path+query, (c) `?next=https://evil.com`, `//evil.com`, `/login`, `/reset-password` → `/dashboard`, (d) simulated verification failure (needs a seam: route/env flag or Playwright network interception of the Supabase auth host; verify feasibility in planning), (e) not-found for a foreign/deleted record (needs a seed row via admin client; depends on whether a record route exists).

#### Verification workflow decision

1. Write unit tests for the DAL and session-state classifier.
2. Push the branch or open a pull request.
3. GitHub Actions starts the local Supabase instance and resets the test database.
4. Run the E2E suite on Linux Chromium, which is the authoritative browser environment because the development Mac is limited to macOS 13.
5. Verify redirect behavior, `next`, session-error screen, retry, and not-found behavior.
6. Inspect the uploaded Playwright report artifact when a run fails.

### 9. Project structure and styling conventions

- Existing layout: `app/<route>/` holds page + co-located client/server components and styles (`app/login/*`, `app/signup/*`, `app/dashboard/*`); `app/actions/` for Server Actions; `lib/session/*` for pure session logic with a barrel `lib/session.ts`; `lib/supabase/*` for client factories; `components/Logo.tsx` is the only shared component; tests mirror structure under `__tests__/`.
- Quirk to note: shared auth UI (`AuthLogo`, `authInputClassName`, `authLinkClassName`) lives in `app/signup/` and is imported by login (`app/login/LoginForm.tsx:7-8`). The new screens (00.6 especially) will need the same pieces; planning should decide whether to promote them to `components/auth/` (matches Next's "colocate vs. shared `components/`" guidance) or keep importing from `app/signup`. Promotion touches existing files and tests — flag as optional refactor, not a prerequisite.
- Tailwind v4 with tokens in `app/globals.css:1-31` (`--navy`, `--sky`, `--azure`, `--warning-*`, `--danger-*`, `--auth-*`) exposed through `@theme inline`; components use string-constant `className`s (e.g. `LoginForm.tsx:13-19`, `LoginAlert.tsx:1-4`) rather than `cva`/`clsx`. The wireframe's `status-ring warn`, `status-steps`, `return-strip` styles don't have tokens/classes yet — new styles should reuse existing tokens and add only what's missing.
- Next 16 specifics worth noting for planning: `proxy.ts` (not `middleware.ts`); `LayoutProps`/`PageProps` globals; async `searchParams`; the `unauthorized()` / `forbidden()` APIs exist but are **experimental** (`authInterrupts` flag) — not needed here and should be avoided for a security-critical path.

## Code References

- `proxy.ts:15-79` — per-request `getClaims()` + expired-cookie cleanup; no redirect; fails open on config error (`:21-35`)
- `proxy.ts:76-78` — `config.matcher` (all but static assets)
- `app/dashboard/page.tsx:10-19` — only existing guard; throws on `lookup_error`, redirects to `/api/auth/session-expired` otherwise
- `app/dashboard/layout.tsx:8-24` — reads expiry for notice, no guard
- `app/api/auth/session-expired/route.ts:5-14` — signOut + redirect to bare `/login` (drops `next`)
- `lib/session/service.ts:15-57` — `fetchEffectiveSessionExpiry`; conflates "no session" with claims errors (`:22-24`)
- `lib/session/claims.ts`, `lib/session/calculations.ts` — pure, already tested; pattern to mirror
- `lib/supabase/server.ts:7-27` — user-scoped (anon key + cookies) server client; the only client new code should use
- `lib/supabase/config.ts:47-65` — config getter (re-reads env per call, intentionally)
- `app/actions/auth.ts:141-201` — `login()`; `redirect("/dashboard")` at `:200`; `signup()` redirect at `:138`
- `app/login/page.tsx:34-42`, `app/login/LoginForm.tsx:21-54`, `app/login/LoginFields.tsx:19-57` — login UI with no `next` handling
- `supabase/migrations/20260902082511_create_rls_policies.sql` — `auth.uid() = user_id` on all tables
- `supabase/docs/nextjoblog-mvp-screens.html:517-584` — screens 00.5 / 00.6 / 00.7
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1017-1233` — optimistic Proxy checks vs. DAL guidance
- `vitest.config.mts:8-18` — coverage gate and exclusions
- `__tests__/dashboard/page.test.tsx` — mocking pattern for guarded pages
- `e2e/login.spec.ts` — seeding + e2e pattern

## Architecture Insights

Proposed unit boundaries (each small, single-responsibility, pure where possible; names are suggestions for the plan):

| Unit | Responsibility | Purity / DI |
| --- | --- | --- |
| `lib/auth/next-path.ts` — `resolvePostLoginPath`, `DEFAULT_POST_LOGIN_PATH`, `AUTH_PATH_PREFIXES` | Sanitize/validate `next`; the sole open-redirect defense | Pure, table-driven tests |
| `lib/auth/login-redirect.ts` — `buildLoginRedirectUrl(pathname, search)` | Build `/login?next=<encoded>` | Pure |
| `lib/auth/route-access.ts` — `PUBLIC_PATHS`, `decideRouteAccess(...)` | Public vs. protected default-deny, allow/redirect decision | Pure; keeps `proxy.ts` thin |
| `lib/auth/session-state.ts` — `classifyClaimsResult(...)` → `authenticated \| unauthenticated \| verification_failed` | Replaces the `undefined`-collapse in `service.ts` | Pure; error predicates injected/imported from auth-js |
| `lib/auth/require-session.ts` — `requireSession()` (DAL, `cache`) | Redirect/render per state; single entry for every protected page | Takes injected `getSessionState`/`redirect` for tests |
| `app/login/…` | Read `searchParams.next`, sanitize, hidden field, return strip | Server page → client form |
| `app/(…)/session-error` UI + `app/not-found.tsx` | Screens 00.6 / 00.7 | Presentational |

SOLID mapping: **S** — validator, classifier, decision, DAL, UI are separate; **O** — adding a public route or auth prefix is a data change (constants), adding a protected route needs no guard edits (default-deny + DAL); **L/I** — small narrow function types rather than a fat `AuthService` interface; **D** — DAL and the proxy decision take dependencies (`redirect`, session fetcher, `now`) as parameters/injection, mirroring `createSupabaseSessionExtensionStore(client)` (`lib/session/extension-store.ts`).

Design tensions to resolve in planning (deliberate, not defects):
1. **Double enforcement.** Proxy redirects (fast, no flash) *and* DAL redirects (authoritative). Both must use the same `buildLoginRedirectUrl` so they can't disagree about `next`.
2. **Fail-open proxy vs. fail-closed DAL.** Keep the proxy's config-error fail-open (changing it risks a redirect loop when Supabase config is broken, because `/login` also needs config), but make the DAL the closed gate and make its failure state the 00.6 UI, not a raw 500.
3. **`/api/auth/session-expired` after this story.** Either extend it to carry a sanitized `next` or retire the "no session" path from it. A confirmed-expired session is the only case that needs cookie deletion (already done in `proxy.ts:63-70`), so the cleaner end-state is: DAL redirects straight to `/login?next=…` and the sign-out handler remains for expired-session cleanup only.
4. **Redirect status/caching.** Use the default `redirect()` (307) so non-idempotent methods behave; never use 308/permanent for auth redirects (browsers cache them). Add `Cache-Control: no-store` consideration for the redirect response so a CDN/browser doesn't cache the login redirect for a later authenticated visit — verify against the Vercel deployment notes in `docs/production-auth.md`.

## Historical Context (from prior changes)

- `context/archive/2026-09-07-log-in-an-existing-account/research.md:153` — Story 0.4 explicitly depends on 0.2 (login exists) and 0.3 (guard must check *restored* session state).
- `context/changes/stay-logged-in-across-browser-sessions/research.md` §3 — "Do not add `/dashboard` redirect-if-unauthenticated logic in [0.3's] plan — that's 0.4's scope"; `redirect()` must be called after, not inside, `try/catch`; coverage backfill rationale (80% gate, `proxy.ts` exclusion).
- `context/archive/2026-09-21-diagnose-production-auth-failure/` + `docs/production-auth.md` — config validation (`SupabaseConfigError`), proxy fail-open rationale, hosted-Supabase constraints relevant to e2e/prod parity.
- `context/changes/stay-logged-in-across-browser-sessions/plan.md:68-100` — precedent for keeping `proxy.ts` optimistic/cheap (no DB), conditional cookie clearing via `isChunkLike`.
- `context/archive/2026-09-28-normalize-repo-root/` — repo root is now `nextjoblog/`; paths in this doc are relative to it.
- No `context/foundation/lessons.md` exists in this repo.

## Related Research

- `context/changes/stay-logged-in-across-browser-sessions/research.md`
- `context/archive/2026-09-07-log-in-an-existing-account/research.md`
- `context/changes/sign-up-for-a-new-account/research.md`
- `context/archive/2026-09-21-diagnose-production-auth-failure/research.md`

## Open Questions

1. **Should `signup()` honor `next`?** **Decision: no, for this story.** Story text scopes `next` to login (Story 0.2). A new user who follows a deep link and chooses signup will use the signup flow, then land on `/dashboard`; `next` is not carried through signup. This keeps registration, email-confirmation, and onboarding behavior out of Story 0.4. Supporting `next` after signup can be handled as a separate future story.
2. **Is `/` public?** **Decision: no.** `/` will be the authenticated home and should behave as the dashboard, so it belongs in the protected route set. Unauthenticated users opening `/` must be redirected to `/login` using the same `next` flow, with `/` as the requested destination. The current placeholder landing page should be replaced or moved out of the root route as part of implementation planning.
3. **Where does retry live and how does 00.6 render?** **Decision: use DAL-returned session state rendered inline, with `router.refresh()` for retry.** The DAL distinguishes `authenticated`, `unauthenticated`, and `verification_failed`: authenticated requests query data and render the page; unauthenticated requests redirect to `/login?next=…`; verification failures render screen 00.6 without signing out or querying application data. The 00.6 Try Again action calls `router.refresh()` to re-run the server check for the same URL. Keep `error.tsx` + stable `retry()` for unexpected runtime errors, not expected session-verification failures; this avoids relying on server error identity surviving the Server Component → Client Component boundary.
4. **Return strip label source:** **Decision: use friendly labels for known routes and never display the raw destination URL.** A pure route-description function will map known destinations to labels such as "An application's notes". For unknown or unsafe destinations, omit the return strip rather than echoing attacker-controlled input; the actual redirect target must still go through `resolvePostLoginPath`.
5. **"View All Applications" button on 00.7:** **Decision: hide the button until the `/applications` route exists.** Do not point it at `/dashboard` as a substitute, because the button's label promises an applications list that the destination would not provide.
6. **Move to a `(protected)` route group vs. keep `app/dashboard`:** **Decision: use a `(protected)` route group.** The home route `/` and `/dashboard` represent the same authenticated dashboard experience and should share the protected structure and guard. The route group does not appear in public URLs, but moving files will require updating existing test import paths (`__tests__/dashboard/*`) and any affected E2E or module mocks. The implementation plan must define whether `/` is the canonical route and `/dashboard` redirects to it, or both render the same page without duplicating page logic.
7. **Promote shared auth UI** (`AuthLogo`, `styles.ts`) out of `app/signup/` to `components/auth/`: **Decision: yes.** Move shared authentication UI and styles to `components/auth/` so login, signup, and future auth screens depend on a neutral shared location rather than `app/signup/`. Update all imports, mocks, and affected tests as part of the implementation; keep signup-specific components co-located under `app/signup/`.
8. **Verification-failure E2E seam:** **Decision: use a test-only server-side seam or environment flag to force `verification_failed` deterministically in E2E.** Do not use browser network interception as the primary mechanism because the session check runs on the server through `proxy.ts`/the DAL, so the Supabase request is not necessarily visible to Playwright's browser routing. The seam must be enabled only in the E2E/test environment, must never be available in production, and should allow the retry test to switch from `verification_failed` back to the normal authenticated result.
9. **Redirect caching headers:** **Decision: mark every auth-sensitive redirect as non-cacheable.** Redirects from protected routes to `/login?next=…` must include `Cache-Control: private, no-store, max-age=0` so browser and CDN caches cannot reuse a session-dependent redirect. The implementation must preserve refreshed cookies when constructing the redirect response, and deployment verification must inspect the actual response headers on Vercel after deploy.
10. **Date/decision source:** **Decision confirmed.** The story cites the decision as "Natta, 1 Oct 2026," matching the research decision record. After login, users must return to the protected page they originally requested, including its query string when safe; no further confirmation is required for this behavior.
