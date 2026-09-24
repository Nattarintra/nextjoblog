# Diagnose Production Signup and Login Failure — Plan Brief

> Full plan: `context/changes/diagnose-production-auth-failure/plan.md`
> Research: `context/changes/diagnose-production-auth-failure/research.md`

## What & Why

Signup and login work locally but fail in production because the deployment boundary is not explicit and the application assumes local Supabase Auth behavior. The plan verifies and hardens the public Supabase configuration path, handles hosted email confirmation correctly, and gives operators a repeatable production diagnosis and smoke-test flow.

## Starting Point

`lib/supabase/server.ts` and `proxy.ts` consume unchecked public Supabase variables. `signup` redirects whenever Supabase returns a user, even without a session, while `login` turns `email_not_confirmed` into a generic error. Local tests and E2E runs use confirmations disabled and do not exercise the hosted configuration boundary.

## Desired End State

The deployed app uses validated Supabase configuration and fails with safe, diagnosable auth states when configuration is wrong. Signup redirects only for an authenticated session; confirmation-required signup and login explain the next step clearly. Vercel and hosted Supabase settings are documented and manually verifiable.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Overall scope | Diagnose and harden | Fix the likely causes and prevent recurrence | Plan |
| Confirmation behavior | Support both modes explicitly | Works with local no-confirmation and secure hosted confirmation settings | Plan |
| Production configuration | Runbook plus safe env contract | Makes external deployment dependencies repeatable without adding dashboard automation | Plan |
| User-facing errors | Explicit safe categories | Gives users recovery guidance without leaking provider details | Plan |
| Observability | Redacted structured diagnostics | Makes Vercel failures actionable without logging secrets or credentials | Plan |
| Verification | Automated local regression plus manual production smoke test | Keeps tests deterministic while checking the real deployment boundary | Plan |
| Invalid configuration | Clear auth-boundary failure | Avoids opaque SDK/URL errors and shortens diagnosis | Plan |
| Shared config module | Pure, uncached getter, re-read on every call | Proxy may run on a separate tier from render-time code in optimized deployments, so shared module-level state can't be relied on (Next Proxy docs) | Plan (Phase 1, post plan-review) |

## Scope

**In scope:**

- Shared runtime validation for the public Supabase URL and key
- Safe handling in the server client and proxy
- Confirmation-aware signup/login action states and UI
- Redacted auth diagnostics
- Direct Server Action and component regression tests
- `.env.example` and a production-auth runbook
- Local E2E regression and manual Vercel/Supabase smoke tests

**Out of scope:**

- Automatic Vercel or Supabase dashboard configuration
- Password reset, OAuth, service-role runtime access, schema/RLS changes, and route-guard work
- External monitoring infrastructure

## Architecture / Approach

`process.env` → shared validated Supabase config → server client and proxy → auth Server Actions → discriminated form states → signup/login alerts. Configuration failures are caught at the auth boundary and logged with redacted metadata. Hosted dashboard settings remain a separate operator-controlled prerequisite.

## Code Quality Standards

- **Coverage**: stays within the repo's existing 80% lines/statements/functions/branches threshold (`vitest.config.mts`) — every new file is covered by new/extended tests, no exclusions added.
- **SOLID / clean code**: single-responsibility config module, dependency-injected (not hardcoded `process.env` reads) call sites, named discriminant states instead of magic strings.
- **Testability**: config getter has no hidden globals, mocks with the repo's existing `vi.mock`/hoisted-mock pattern.
- **Accessibility**: new alert states reuse the existing `role="alert"`, keyboard-reachable pattern; no color-only signaling.
- **Structure**: no new top-level conventions — new files land in the existing App Router layout (`app/actions/`, `app/signup/`, `app/login/`, `lib/supabase/`, `__tests__/`, `e2e/`, `docs/`) per [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure).

Full detail: plan.md § Code Quality Standards.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Configuration boundary | Validated runtime config, proxy safety, redacted diagnostics | Proxy/module-load behavior must remain compatible, including keeping the shared config module stateless and preserving the exact auth-cookie-key derivation `e2e/session-expiry.spec.ts` depends on |
| 2. Auth hardening | Session-aware signup, confirmation-aware login, UI states, action tests | Existing local flow must not regress |
| 3. Verification and runbook | E2E preservation (including `e2e/session-expiry.spec.ts`), deployment contract, production checklist | External hosted settings may still drift |

**Prerequisites:** Access to the Vercel Production environment and hosted Supabase Auth settings for final manual verification; local Supabase variables for automated tests.

**Estimated effort:** ~2–3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- The hosted Supabase error code for unconfirmed email (`email_not_confirmed`) is already confirmed as a stable value in the installed `@supabase/auth-js` `ErrorCode` type, so tests can rely on it directly; only the hosted project's actual confirmation-enabled/disabled setting remains external state to verify live.
- Vercel Production variables and hosted Supabase Site URL/confirmation settings are external state and cannot be changed by repository code.
- The local E2E suite continues to run with confirmations disabled; confirmation-required behavior is tested deterministically at the action/UI level.

## Success Criteria (Summary)

- A production configuration problem yields a safe user failure and a useful redacted Vercel diagnostic.
- Signup and login behave correctly whether hosted email confirmation is disabled or enabled.
- Automated tests pass, and the documented production smoke test proves the deployed configuration and Auth settings are aligned.
- Coverage thresholds (80% lines/statements/functions/branches) and code-quality standards above hold for all new/changed files.
