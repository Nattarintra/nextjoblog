# Request a Password Reset Email (Story 0.6) — Plan Brief

> Full plan: `context/changes/request-password-reset-email/plan.md`
> Research: `context/changes/request-password-reset-email/research.md`

## What & Why

Let a Job Seeker request a password reset link from `/forgot-password` without the system revealing whether the email has an account. This is the first half of the reset flow; Story 0.7 consumes the link. It needs a layered rate limit and a `token_hash` recovery email, so the link works across devices.

## Starting Point

The routes `/forgot-password` and `/reset-password` are already public and Login links to the missing page (404). There is no reset action, limiter, IP reader, confirm handler or mail E2E helper. Login and Signup duplicate the shell, fonts and button styles.

## Desired End State

Every valid request shows **Check Your Email** (registered, unknown, email-limited, provider-error look identical). More than 5 requests/hour from one IP shows **Too Many Reset Requests** with a countdown. Registered users get an email linking to `/api/auth/confirm?token_hash=…`. Auth pages share one shell. CI is green with the run ID recorded.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Visible limit | Only the IP limit shows the limited screen | Does not leak account existence | Research |
| IP policy | Token bucket, 5/hour (refill 12 min) | Matches mockup, smooth refill | Research |
| Email limits | 60 s cooldown + 5/hour ceiling, both silent | Caps inbox spam without a leak | Plan |
| Store | Generic Postgres table + atomic `SECURITY DEFINER` RPC (scope allow-list, key length cap) | No new service; shared across Vercel instances; limits junk-row flooding | Research / Plan |
| Timing | Provider call deferred with `after()`; small `MIN_RESPONSE_MS` floor (injected clock) only levels limiter variance | Response time no longer depends on whether the account exists | Review F2 |
| Release gate | `PASSWORD_RESET_ENABLED` flag hides the Login link and disables sending until Story 0.7 ships | `main` auto-deploys to Vercel; the link 404s without 0.7 | Review F1 |
| Missing IP / tests | Test IP header only with `E2E_TEST_HOOKS=1`; production missing header uses a looser `unknown` bucket | E2E needs distinct IPs; no global lockout | Review F3 |
| Provider client | Stateless `createClient`, no cookies | PKCE verifier unused with `token_hash` | Review F5 |
| Keys | HMAC with server secret (validated, distinct log if missing); NFKC+lowercase email; `x-vercel-forwarded-for` IP | No raw PII stored; no spoofable header trust | Plan |
| Link flow | `token_hash` template → `/api/auth/confirm`; handler in 0.7 | Cross-device; clean story boundary | Research / Plan |
| Limiter outage | Fail closed on sending, return neutral `sent` | Never exposes state | Research / Plan |
| Refactor | Extract shared auth primitives first, own phase | DRY; existing tests as safety net | Research / Plan |
| Verification | Unit locally; pgTAP + Playwright in CI only | Chromium unsupported on macOS 13 | Plan |

## Scope

**In scope:** shared auth primitives; limiter port, adapters, migration and pgTAP; use case, action, Supabase config and recovery template; three accessible screens and countdown hook; CI E2E with mail capture; docs and `change.md` reconciliation.

**Out of scope:** the confirm handler, reset-password page, `updateUser` and recovery-session handling (Story 0.7); SMS; CAPTCHA; Redis.

## Architecture / Approach

Pure, injected logic in `lib/auth/` (IP parser, key hasher, email normaliser, `RateLimiter` port, min-duration helper, use case) behind a thin Server Action. Client components only render action state. Postgres RPC backs the limiter in production; an in-memory adapter serves tests. Supabase's own limits are only a backstop.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared auth primitives | One shell, fonts, styles for all auth pages (Signup `<h1>` as separate step 1.6) | Regressing Login/Signup visuals |
| 2. Rate-limit foundation | Helpers, port, adapters, migration, pgTAP | RPC security and drift between `supabase/` and `supabase-test/` |
| 3. Use case, action, config | Neutral outcomes, limits, `after()` send, release flag, email template | Anti-enumeration leaks; hosted config drift |
| 4. Forgot Password UI | Three screens, countdown, a11y | Focus/announcement behavior; contrast |
| 5. CI E2E and docs | Mail helper, specs, workflow, evidence | Mail service endpoint unknown until first CI run |

**Prerequisites:** Story 0.1 (done); Docker/Supabase CLI available in CI; ability to set Vercel and hosted Supabase settings.
**Estimated effort:** ~4–5 sessions across 5 phases.

## Open Risks & Assumptions

- Supabase's unknown-email and 429 behavior is unverified until CI runs; neutral mapping holds regardless.
- Emailed link 404s until Story 0.7 ships; `PASSWORD_RESET_ENABLED` stays off in Production until then.
- A reload resets the screen to the form (server limiter stays authoritative); an email-limited user silently gets no email, by design.
- Shared-IP networks (offices, campuses) may hit the 5/hour IP limit.
- Mail capture service (Inbucket vs Mailpit) for CLI 2.117.0 is confirmed on the first CI run.

## Success Criteria (Summary)

- Users see the same Check Your Email result for any valid email; only an IP limit shows the countdown screen.
- A registered address gets a captured recovery email with a `token_hash` link that opens in a fresh browser context.
- Lint, typecheck, unit coverage gates and the CI workflow (including pgTAP and Playwright) pass, with the run ID recorded. `supabase test db` is added to CI in Phase 2.
