# Stay Logged In Across Browser Sessions — Plan Brief

> Full plan: `context/changes/stay-logged-in-across-browser-sessions/plan.md`
> Research: `context/changes/stay-logged-in-across-browser-sessions/research.md`

## What & Why

As a Job Seeker, session persistence should last 30 days across browser restarts, with a day-28 "expiring soon" notice, so the user isn't forced to re-log-in constantly nor silently logged out without warning. This is the session-persistence half of the original login story, split out because it's separable engineering work (token lifetime, refresh handling) from the login form itself.

## Starting Point

`proxy.ts` and `lib/supabase/server.ts` already refresh sessions on every request via Supabase's `getClaims()`, but nothing bounds how long a session lives — cookies default to 400 days and Supabase's own `[auth.sessions] timebox` setting sits commented out. No client-side Supabase usage or `/dashboard` route exists yet; both are new territory this story introduces.

## Desired End State

A user who closes and reopens the browser within 30 days stays logged in with no re-entry of credentials. Between day 28–30, an open app shows a dismissable "session expiring soon" modal (Yes/No) that doesn't reappear once answered. Past day 30, or with a missing/corrupted session, the user is silently treated as logged out — never an error screen — and RLS still scopes data to the restored user.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Session lifetime mechanism | Supabase `[auth.sessions] timebox = "720h"` | Server-side, identity-provider-level enforcement — not hand-rolled cookie/JWT logic | Research |
| Hosted config rollout | Deploy code first; flip hosted dashboard `timebox` as a separate deliberate step after | Flipping it retroactively logs out already-expired sessions instantly, with no chance to see the day-28 notice | Research |
| "Already responded" flag storage | Cookie with `expires` set to `sessionExpiresAt` | No new persistence layer; survives a browser restart during the day-28–30 window (unlike a no-expiry cookie) and is naturally superseded by the next login's fresh session | Plan (revised in plan review) |
| Client's expiry source | Server Component computes it from `getClaims()`, passes as a prop | Keeps the server as the single source of truth; matches the app's server-only architecture | Plan |
| How expiry timestamp is derived | `amr[0].timestamp + 30d` from JWT claims | `getClaims()` has no session `created_at`; `amr` timestamps are set at login and not touched by token refresh | Plan (research spike) |
| Modal trigger timing | Mount-time check + one `setTimeout` to the day-28 boundary | Exact, no polling waste, trivially unit-testable as a pure function | Plan |
| Dashboard scope | Minimal placeholder only, hosting the notice component | Keeps this story's diff to session persistence, not dashboard design (that's future work) | Plan |
| Coverage tool & gate | `@vitest/coverage-v8@4.1.11` (pinned to match installed `vitest`), enforced 80% threshold in config | Makes "80% coverage" objectively checkable, not a manual habit, and avoids a mismatched-version resolution error | Plan |
| E2E expiry simulation | Dedicated short-`timebox` local Supabase project (`supabase-test/`, own config + migrations + seed, run via `supabase start --workdir`), real GoTrue enforcement | Matches this repo's "real Supabase, nothing mocked" e2e convention; the CLI has no flag to swap in an alternate config file within the same project, only `--workdir` for a separate one | Plan (revised in plan review) |
| Cookie-clearing location | `proxy.ts`, right after `getClaims()` confirms expiry — clears by enumerating cookie names via the auth storage-key prefix, not a fixed name list | Single enforcement point already running on every request; avoids duplicating the check per route; prefix-based enumeration also catches `@supabase/ssr`'s chunked auth cookies | Plan (revised in plan review) |
| Modal component location | `app/dashboard/SessionExpiryNotice.tsx`, mirroring signup/login's split | Matches the validated Server/Client component pattern already used twice in this repo | Plan |

## Scope

**In scope:** 30-day session enforcement (local + documented hosted step), expired/corrupted-session handling in `proxy.ts`, a dashboard placeholder, the day-28–30 notice modal (render + Yes/No + "don't repeat" flag), 80%-enforced test coverage, e2e coverage of expiry/corruption/RLS-after-restore.

**Out of scope:** Route guards/redirects for unauthenticated access (Story 0.4), the "Yes" extension action and its 60-day math (Story 0.3b), a "remember me" opt-out, real dashboard content, automated push of the hosted Supabase config.

## Architecture / Approach

Enable Supabase Auth's own session-timebox feature rather than hand-rolling expiry logic, teach the existing `proxy.ts` refresh path to clear cookies on confirmed expiry, then layer on the minimum new client-side surface (one Server Component computing expiry from JWT claims, one Client Component rendering the modal) needed to satisfy the day-28 notice requirement — extending established patterns (component split, real-Supabase e2e) at every step rather than introducing new ones.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Session Timebox Enforcement | Local `timebox = "720h"` config | Hosted dashboard flip must stay a separate manual step |
| 2. Expired and Invalid Session Handling in `proxy.ts` | `proxy.ts` clears cookies on confirmed expiry | First conditional branch in a previously branch-free file |
| 3. Dashboard Placeholder and Expiry Plumbing | `/dashboard` route + server-computed expiry prop | `amr[0].timestamp` derivation is a novel technique, not an SDK-documented API |
| 4. Day-28–30 Expiry Notice Modal | Day-28–30 Yes/No modal, non-repeating | Timer drift on backgrounded tabs (mitigated by re-check on mount) |
| 5. Test Coverage Tooling | Enforced 80% threshold | Excluding non-unit-testable files without under-covering real code |
| 6. E2E Verification | Real-timebox, cookie-tamper, and RLS-restore tests | `supabase-test/` short-timebox project must not leak into the normal dev stack, and its migrations must be kept in sync with `supabase/migrations/` |

**Prerequisites:** Story 0.2 (Log In to an Existing Account) — already implemented.
**Estimated effort:** ~3-4 sessions across 6 phases.

## Open Risks & Assumptions

- `amr[0].timestamp` as a proxy for session start is not an officially documented Supabase API guarantee — it's derived from observed JWT/GoTrue behavior (no new `amr` entries on token refresh) and should be spot-checked against a real token during Phase 3 implementation.
- The hosted-dashboard `timebox` flip remains a manual, unautomated step after this change ships — a process risk (easy to forget) rather than a code risk, flagged explicitly in Migration Notes.
- `supabase-test/` duplicates `supabase/migrations/` for the short-timebox e2e project; the two must be kept in sync by hand — a maintenance risk introduced during plan review once the sibling-config-file approach was found not to be supported by the Supabase CLI.

## Success Criteria (Summary)

- A user can close and reopen the browser within 30 days and stay logged in with no re-entry of credentials.
- Between day 28 and 30 of an open session, the user sees the expiring-soon notice exactly once until they respond.
- A session past 30 days, or a corrupted/missing one, always results in the login page — never an error screen — and RLS remains scoped to the restored user.
