# Set a New Password from a Reset Link (Story 0.7) — Plan Brief

> Full plan: `context/changes/set-a-new-password-from-a-reset-link/plan.md`
> Research: `context/changes/set-a-new-password-from-a-reset-link/research.md`

## What & Why

Finish the password-reset flow started in Story 0.6. A Job Seeker who clicks the emailed link can set a new password and is logged in straight away; a dead link explains itself and offers a new one. Without this, the emailed link 404s and users stay locked out.

## Starting Point

`/reset-password` is a public path with no page. The link arrives with tokens in the URL fragment (implicit flow), which only the browser can read. The minimum password length of 6 is duplicated in five places, and the E2E suite copies its Supabase admin and user-setup code across three specs.

## Desired End State

Opening a valid link shows "Set a New Password". Saving a valid password lands on the Dashboard, logged in, with a "Password updated" toast. A short password shows the minimum rule and changes nothing. An expired, used, missing or rejected link shows "This Reset Link No Longer Works" with "Request a New Link".

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Minimum length | 6, one shared constant | Matches Sign Up; removes five copies | Research |
| After save | Auto-login to Dashboard + toast | Mockup and "log in immediately" | Research |
| Where the update runs | Server Action, cookie session only after update succeeds | Browser client rejects implicit URLs; failed save must not log anyone in | Research |
| Save failures | Inline errors, form stays filled | User can retry without a new email | Research |
| Scanner-consumed links | Documented limitation | Needs a paid template path | Research |
| E2E DRY scope | Extract helpers and migrate all 3 existing specs | One definition, no drift | Plan |
| Expired link in E2E | Request a second link, open the older one | Real provider behaviour, no waiting | Plan |
| Subtitle email | Decode unverified `email` claim from the token | Matches mockup, no extra request | Plan |
| Password input | Promote generic `PasswordInput`, Sign Up uses it | One accessible implementation | Plan |
| Same password | Inline error, keep form | Honest feedback, no silent no-op | Plan |
| Session-clock risk (`amr`) | CI test is the gate, fix after evidence | No speculative change to shared code | Plan |

## Scope

**In scope:** reset page, form, expired screen, Dashboard toast, shared password policy and input, Server Action, shared E2E helpers, CI-only E2E, production docs and release step.

**Out of scope:** password-changed email, signing out other devices, MFA, custom email template, running Playwright locally.

## Architecture / Approach

Pure logic in `lib/auth/` (parser, validator, classifier, `completePasswordReset` over two injected ports). A thin Server Action updates the password with a stateless client and only then starts the cookie session. The client flow reads and strips the URL fragment, keeps tokens in memory, and renders the state returned by the action.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared policy and input | One password rule, generic `PasswordInput`, copy | Regressing Sign Up |
| 2. Recovery logic | Parser, validator, classifier, use case | Missing an error code |
| 3. Server Action | Update + cookie session, shared stateless client | Session written on failure |
| 4. UI | Page, form, expired screen, toast | Accessibility and focus details |
| 5. CI-only E2E | Shared helpers, migrated specs, reset spec | Typos only visible in CI; `amr` clock |
| 6. Docs and release | Hosted settings, limitation note, enable flag | Forgetting hosted dashboard steps |

**Prerequisites:** Story 0.6 merged (done); hosted redirect URL and minimum length set before enabling.
**Estimated effort:** about 4-6 sessions across 6 phases, plus CI rounds.

## Open Risks & Assumptions

- The implicit-flow link shape and `amr[0]` on a recovery session are inferred from source and proven only in CI.
- Email scanners can consume a link; users then see the expired screen.
- E2E cannot run locally, so each CI failure costs a push.

## Success Criteria (Summary)

- A user can reset and reach the Dashboard logged in, with the new password working immediately.
- Short, mismatched, same, expired and used cases all behave as specified and never create a session.
- Unit gates and the GitHub Actions run are green, with the run ID recorded.
