# Log In to an Existing Account — Plan Brief

> Full plan: `context/changes/log-in-an-existing-account/plan.md`
> Research: `context/changes/log-in-an-existing-account/research.md`

## What & Why

Add a `login` Server Action and `/login` route so a Job Seeker with an existing account can authenticate with email + password and reach the Dashboard. This establishes the session every later story relies on through RLS.

## Starting Point

The sign-up story (merged, PR #1) already built every piece of shared infrastructure this needs: `proxy.ts` session-refresh, the Supabase client factory, the Server-Action + `useActionState` pattern, Tailwind design tokens, and Vitest/Playwright tooling. Nothing new needs to be installed — this is an additive slice, not foundational work. All five RLS-protected tables the AC names (`applications`, `cv_documents`, `status_history`, `reminders`, `conversation_notes`) already exist with owner-scoped policies from an earlier migration.

## Desired End State

A user visits `/login`, enters correct credentials, and is redirected to `/dashboard` (404 expected — same as sign-up today). Wrong password, wrong email, and unregistered email all show the identical "Email or password is incorrect" message. Email matching is case-insensitive. Once logged in, RLS scopes every protected-table query to that user alone, verified directly rather than assumed from the schema.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Error state granularity | 2-state union: `invalid_credentials` \| `unknown` | Satisfies anti-enumeration with minimal surface; rate-limit errors bucket into `unknown` and are logged server-side | Plan |
| Field components | New, simpler `LoginFields`/`LoginAlert` (not signup's) | Login has no password-shape validation, so signup's helper-text plumbing doesn't apply | Plan |
| Pending-button copy | "Logging in…" | Matches signup's established "Creating account…" convention | Plan |
| Server-side email validation | Same shape-check regex as signup | Consistent defensive pattern already reviewed and accepted for signup | Plan |
| Rate-limit UX | Bucketed into the generic error message | No AC requires a dedicated state; keeps the error union small | Plan |
| Test coverage split | Vitest for UI/branching, Playwright for server-backed behavior (case-insensitivity, anti-enumeration, RLS) | Matches the exact convention already reviewed for signup; each layer tests what it can actually exercise | Plan |
| Shared presentational assets | Import `styles.ts`/`AuthLogo` read-only from `app/signup/`, no duplication or refactor | Avoids touching shipped/reviewed signup code while still avoiding duplication | Plan |

## Scope

**In scope:**
- `login` Server Action with the 2-state error union
- `/login` route + `LoginForm`/`LoginFields`/`LoginAlert` components
- New `--danger-tint`/`--danger-fg` design tokens
- Vitest unit tests + Playwright E2E tests covering every AC, including a direct RLS-scoping check

**Out of scope:**
- Route-guarding protected pages (Story 0.4 / issue #6)
- `/forgot-password` and `/dashboard` destination pages
- Social login, MFA, app-level rate limiting
- Any change to signup's existing components or tests

## Architecture / Approach

Mirrors the sign-up vertical slice exactly: a Server Action calling Supabase Auth, a thin Server Component route page, and a Client Component form using `useActionState`. The only new pattern is the RLS-scoping E2E test, which talks to Supabase directly (via `supabase-js`, not the browser) to prove row-level security holds for a freshly authenticated session.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Login Server Action | `login()` in `app/actions/auth.ts` | Accidentally branching error messages by field would reopen the enumeration hole |
| 2. Login UI | `/login` route + components + tokens + unit tests | None significant — closely mirrors reviewed signup UI |
| 3. Playwright E2E | Full AC coverage incl. RLS scoping | RLS test needs correctly-shaped fixture rows to satisfy `applications`'s NOT NULL columns |

**Prerequisites:** Sign-up story merged (done — PR #1). Local Supabase running with existing migrations applied.
**Estimated effort:** ~1 session across 3 phases — largely mechanical given how much sign-up already provides.

## Open Risks & Assumptions

- The exact `/forgot-password` route slug is assumed (not yet specified anywhere) — link will 404 until that story is built, which is expected and matches signup's pre-existing `/login` link before this task.
- HTTPS/TLS enforcement is an environment/config guarantee, not something a local Playwright run can assert — verified manually per-environment instead.

## Success Criteria (Summary)

- A user with valid credentials reaches `/dashboard`; any invalid combination (wrong password, wrong or unregistered email) shows one indistinguishable error message.
- Case-differing email input still authenticates.
- A logged-in user's queries against any RLS-protected table return only their own rows, confirmed by a real query rather than inferred from the schema.
