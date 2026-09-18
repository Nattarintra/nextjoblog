# Extend Sessions Through Stay-Logged-In Confirmations — Plan Brief

> Full plan: `context/changes/extend-session-via-stay-loggen-in/plan.md`
> Research: `context/changes/extend-session-via-stay-loggen-in/research.md`

## What & Why

Give the existing "Stay logged in?" dialog's Yes button a real, distinct effect: extend the session's expiry by 30 days from its *current* expiry, repeating indefinitely with no cap, so a Job Seeker never has to fully log in again as long as they keep confirming. Today Yes and No are wired to the identical dismiss handler — this story is entirely about closing that gap.

## Starting Point

Story 0.3 shipped the notice UI, the day-28–30 window math, and a `proxy.ts` branch that clears cookies on GoTrue's own `session_expired` error. No server action exists; no distinction between Yes and No exists anywhere in the code; and GoTrue's session `timebox` (30 days, fixed from login) cannot be moved forward by any documented Supabase API short of a full re-login.

## Desired End State

Clicking Yes pushes the session's expiry 30 days past its current expiry and dismisses the dialog; the same prompt reappears 2 days before whatever the new expiry becomes, and again after that, uncapped. No or non-response lets that cycle expire on schedule — enforced by the app itself, since GoTrue's own fixed ceiling is removed in production. A failed extension shows an inline error and changes nothing.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Extension mechanism | New `session_extensions` app table, not a GoTrue setting | GoTrue has no API to move `amr[0].timestamp`/`timebox` forward | Research |
| Production `timebox` | Removed entirely | The app becomes the real ceiling once extensions exist | Research |
| DB read location | `app/dashboard/` only — `layout.tsx` (notice) and `page.tsx` (enforcement), via a shared `lib/session.ts` helper | Keeps `proxy.ts` DB-free per its existing "optimistic" design | Research |
| Sign-out enforcement | `app/dashboard/page.tsx` calls `signOut()` + `redirect("/login")` when effective expiry passes — not `layout.tsx` | Next.js docs warn a layout can't reliably gate access (doesn't re-render on client nav, doesn't stop child segments rendering); enforcement must sit in the page/leaf component | Plan (post plan-review triage) |
| Cycle tracking | Cookie value keyed to the cycle's own expiry timestamp | Prevents a past cycle's answer suppressing the next cycle's prompt | Plan |
| Error UX | Inline error, dialog stays open, Yes button retryable | Matches the AC's explicit "user sees an error" requirement | Plan |
| Extension schema | `session_id` (PK) / `user_id` (FK+RLS) / `extended_until` / `created_at` / `updated_at` | Matches every other table's timestamp convention in this repo | Plan |
| E2E coverage | 2 full extension cycles | Proves the loop isn't hardcoded to a single extension | Plan |
| CI | Split `unit-tests` / `e2e-tests` jobs | Isolates failures; test harness itself is unchanged | Research |

## Scope

**In scope:** `session_extensions` table + RLS, extend-session Server Action, shared extension-aware expiry helper (`lib/session.ts`) plus enforced sign-out in `app/dashboard/page.tsx`, distinct Yes/No client behavior with error UX, cycle-keyed responded cookie, unit + e2e test coverage, CI job split.

**Out of scope:** route guards for non-dashboard routes (Story 0.4), any cap on total elapsed extensions, silent/automatic extension, extension-history audit log, hosted Supabase dashboard `timebox` toggle automation.

## Architecture / Approach

GoTrue keeps issuing/refreshing the underlying session with no fixed ceiling; NextJobLog layers its own expiry on top via `session_extensions`, read once per dashboard render through a shared `lib/session.ts` helper (never in `proxy.ts`). A Server Action upserts the row on Yes; `layout.tsx` calls the helper to compute `max(base 30-day expiry, extended_until)` for the notice UI, while `app/dashboard/page.tsx` calls the same helper and force-signs-out when that value has passed — Next.js's own docs warn a shared layout can't reliably gate access, so the actual enforcement lives in the page, not the layout. Because a Server Component can't reliably write response cookies during render, the actual sign-out call was moved into a dedicated route handler (`app/api/auth/session-expired/route.ts`) that `page.tsx` redirects to, rather than calling `signOut()` inline.

**As-built module layout** (recorded post-implementation, impl review 2026-09-18): `lib/session.ts` is a barrel over a `lib/session/` package (`calculations.ts`, `claims.ts`, `config.ts`, `errors.ts`, `extension-store.ts`, `service.ts`), and `app/actions/session.ts` imports from those modules directly, with one sibling file, `session-messages.ts`, for user-facing copy (an earlier revision's three pure re-export shims — `session-claims.ts`, `session-errors.ts`, `session-extension-store.ts` — were removed during impl-review triage as unnecessary indirection). `getEffectiveSessionExpiry` returns a `{status: "authenticated" | "lookup_error", ...}` union rather than a flat optional, so a failed DB read fails loud (rethrown by `page.tsx`) instead of being treated as "not authenticated."

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB schema | `session_extensions` table + RLS, mirrored migration, `timebox` removed | Migration drift between `supabase/` and `supabase-test/` |
| 2. Server Action | `extendSession()` upserting the next expiry | Compounding from current expiry, not `Date.now()` |
| 3. Dashboard DAL enforcement | Shared expiry helper (`lib/session.ts`); `layout.tsx` reads it for the notice, `page.tsx` enforces forced sign-out | GoTrue no longer backstops a missed enforcement bug; layout alone can't reliably gate access per Next.js docs |
| 4. Client wiring | Distinct Yes handler (as-built: a `useSessionExtension` hook wraps the `useActionState` call rather than the dialog calling it directly), cycle-keyed cookie, inline error/retry | Cookie logic regressing the existing keyboard/a11y tests |
| 5. Test coverage | Updated unit tests, new action tests, 2-cycle e2e, RLS e2e | Long-running short-timebox e2e test (~60s+ for 2 cycles) |
| 6. CI split | Independent `unit-tests`/`e2e-tests` jobs | None — additive workflow change only |

**Prerequisites:** Story 0.3 (base session + notice UI) already merged.
**Estimated effort:** ~2-3 sessions across 6 phases.

## Open Risks & Assumptions

- Removing the production `timebox` means a bug in `app/dashboard/page.tsx`'s enforcement leaves a session alive indefinitely with no GoTrue backstop — Phase 3's manual verification specifically targets this. Enforcement is deliberately not centralized in `layout.tsx` (a layout can't reliably gate access per Next.js's own docs), so any future dashboard route must repeat the same check.
- The 2-cycle e2e test lengthens an already-long short-timebox suite; if CI time becomes a problem, cycle count is the first thing to revisit.

## Success Criteria (Summary)

- A user can say Yes repeatedly, indefinitely, and never has to fully log in again
- A user who says No or doesn't respond is signed out exactly on schedule, not before or after
- A failed extension never silently succeeds from the user's perspective
