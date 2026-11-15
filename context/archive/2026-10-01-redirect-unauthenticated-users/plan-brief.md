# Redirect Unauthenticated Users from Protected Pages — Plan Brief

> Full plan: `context/changes/redirect-unauthenticated-users/plan.md`
> Research: `context/changes/redirect-unauthenticated-users/research.md`

## What & Why

Logged-out users who open any protected URL must be redirected to `/login?next=<path+query>` and returned there after login (Story 0.4, issue #6). Because `next` is user-controlled it must be validated against open redirects, and the guard must fail closed: a failing session check shows a retry screen, never protected content and never a silent sign-out.

## Starting Point

Only `app/dashboard/page.tsx` guards itself, and it drops the requested URL. `lib/session/service.ts` treats a network failure like "no session", so an outage currently signs the user out. `login()` always redirects to `/dashboard`; `proxy.ts` never redirects. RLS is already enforced in the database; no record routes or `not-found`/`error` pages exist.

## Desired End State

A logged-out request to any non-public URL gets a 307 to `/login?next=…` with no-store headers and no protected markup. After login the user lands on their original path and query; unsafe `next` values land on `/dashboard`. If the session check fails, a "We couldn't verify your session" screen with **Try Again** appears and the session is untouched. Missing or foreign records show a generic not-found page.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| `next` on signup | Not supported | Story scopes `next` to login | Research |
| `/` | Protected; redirects to `/dashboard` (canonical) | Matches the story's fallback and existing tests | Research + Plan |
| Guard layers | Proxy (optimistic) + DAL `requireSession()` (authoritative) | Next 16 guidance; no flash and no layout-only auth | Research |
| Session failure UI | Inline 00.6 from DAL result, retry via `router.refresh()` | Avoids error identity loss across the server→client boundary | Research |
| Route structure | `(protected)` route group; shared auth UI → `components/auth/` | Shared guard structure; neutral shared location | Research |
| Expired-session path | Extend `/api/auth/session-expired` with sanitized `?next=` | Keeps cookie cleanup in a response context and preserves deep link | Plan |
| E2E failure seam | Cookie gated by `E2E_TEST_HOOKS=1` and non-production | Allows fail-then-retry-success; inert in prod | Plan |
| Not-found | Global `not-found.tsx` + `notFoundIfMissing` helper | No speculative record route; zero rows ⇒ 404 never leaks existence | Plan |
| Redirect caching | `private, no-store, max-age=0` on every auth redirect | Prevent caching a session-dependent redirect | Research |
| Testability | All decisions pure in `lib/auth/`; `proxy.ts` thin; 90% gate on `lib/auth/**` (thin `request-path.ts` adapter excluded, like `proxy.ts`) | `proxy.ts` is coverage-excluded; framework glue is not worth contrived tests | Research + Plan + Review |
| Guard enforcement | Layout stays presentational (calls `getEffectiveSessionExpiry`, never `requireSession`); a vitest asserts every `(protected)` page references `requireSession` | Per-page guards are opt-in and the proxy fails open on config errors | Plan review |
| Request-path header | Set on `request.headers` / forwarded headers so it survives the `setAll` response rebuild on token refresh | Otherwise expired-token requests lose the deep link | Plan review |

## Scope

**In scope:** `next` sanitizer, login redirect, default-deny proxy redirect, DAL, 3-state session classifier, screens 00.5/00.6/00.7, route group, shared UI promotion, E2E + CI, `docs/route-guard.md`.

**Out of scope:** `next` after signup, roles, `/applications` pages and "View All Applications" button, forgot/reset-password pages, preserving form input, experimental `unauthorized()`.

## Architecture / Approach

Pure modules in `lib/auth/` (paths, `resolvePostLoginPath`, URL builders, `describeDestination`, `decideRouteAccess`, `classifyClaimsResult`) are used by both the proxy (redirect only on definite "unauthenticated") and the DAL (redirect, or return `verification_failed` for 00.6). The proxy forwards the original URL to the DAL in a request header. The login page and the `login()` action each re-validate `next`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure auth-redirect core | Sanitizer, builders, route-access, classifier + tests | Missing an open-redirect vector |
| 2. Promote shared auth UI | `components/auth/` move | Stale imports/mocks |
| 3. Login honours `next` | Page, hidden field, return strip, action | `redirect` inside `try/catch`; branch coverage in `auth.ts` |
| 4. Session classification + DAL | 3-state lookup, `requireSession`, seam, expired handler | Consumers of the changed return type |
| 5. Route group + screens | `(protected)`, `/` redirect, 00.6, 00.7, helper, protected-pages guard test | Test import churn; a11y of 00.6 |
| 6. Proxy wiring + E2E | Default-deny redirect, no-store, Playwright (incl. updating `session-expiry.spec.ts` URL assertions), CI | Cookie/header loss on redirect or token refresh; header surviving CDN |

**Prerequisites:** Stories 0.2 and 0.3 (done); local Supabase for E2E.
**Estimated effort:** ~4-6 sessions across 6 phases.

## Open Risks & Assumptions

- Passing the original URL via a proxy-set request header is assumed to work in Next 16.3.4; verify against `proxy.md` "Setting headers" in Phase 4/6.
- Client-side (RSC) navigations may leave `_rsc` in the search string used to build `next`; verify via manual step 6.7 and strip it if observed.
- "Deleted/foreign record" is proven only as routing + generic 404 (`/applications/123` hits the global not-found) plus a stub-fetcher unit test and an RLS e2e check; the record-level check moves to the Feature 1 plan.
- Vercel header behaviour can only be confirmed after deploy (manual step 6.4).

## Success Criteria (Summary)

- Every acceptance criterion in the story has a passing automated test, with E2E green on GitHub Actions.
- Coverage ≥ 80% overall and ≥ 90% for `lib/auth/**`.
- No open-redirect vector in the sanitizer table passes; no failure path signs the user out or exposes protected data.
