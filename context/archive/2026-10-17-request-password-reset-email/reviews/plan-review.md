<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Request a password reset email (Story 0.6)

- **Plan**: context/changes/request-password-reset-email/plan.md
- **Mode**: Full (change.md, research.md, plan.md and plan-brief.md read; claims spot-checked against the repo)
- **Date**: 2026-10-20
- **Verdict**: APPROVED (initial verdict REVISE; all 12 findings fixed in plan.md and plan-brief.md on 2026-10-20)
- **Findings**: 3 critical, 5 warnings, 4 observations

## Verdicts

| Dimension | Initial | After triage |
|-----------|---------|--------------|
| End-State Alignment | WARNING | PASS |
| Lean Execution | PASS | PASS |
| Architectural Fitness | WARNING | PASS |
| Blind Spots | FAIL | PASS |
| Plan Completeness | WARNING | PASS |

**Residual risks (do not block implementation):**
- `after()` probed on `next dev` only (response not delayed, errors isolated); not yet proven on Vercel (`waitUntil`) or against real Supabase.
- Supabase unknown-email and 429 behavior, and the mail-capture endpoint (Inbucket vs Mailpit), are confirmed only on the first CI run.
- The RPC flood risk is reduced (scope allow-list, key cap) but not eliminated within the retention window.
- `PASSWORD_RESET_ENABLED` must stay off in Production until Story 0.7 ships (plan step 3.9).

## Grounding
Paths and symbols cited in the plan checked: `lib/auth/paths.ts` public prefixes ✓, `app/actions/auth.ts` (private `emailShapePattern`, `"use server"`) ✓, `lib/supabase/server.ts` (`@supabase/ssr` client) ✓, `supabase/config.toml` (`email_sent = 2`, `https://127.0.0.1:3000` allow-list, `[inbucket]`) ✓, CI workflow (root `supabase start`, no `supabase test db`) ✓, `supabase/tests/` ✗ (does not exist yet, created by this plan), `NEXT_PUBLIC_SITE_URL` unused in code ✓. brief↔plan ✓, Progress↔Phase ✓. Mail-capture endpoint and Supabase unknown-email/429 behavior remain unverified until the first CI run.

## Findings

### F1 — Merging to `main` ships a flow whose link 404s

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: "What We're NOT Doing"; Phase 5 manual 5.5; brief "Open Risks"
- **Detail**: Research records that Vercel Production deploys from `main`. The plan only says "0.6 must not be released to production alone", with no mechanism. Users could request real emails whose `/api/auth/confirm` link 404s, and the hosted template/redirect steps (3.7) would be done before 0.7 exists.
- **Fix A ⭐ Recommended**: Gate the feature: hide the Login "Forgot password?" link and have the action return a disabled state unless an env flag (for example `PASSWORD_RESET_ENABLED`) is set; enable it in Production only when 0.7 ships. Add the flag to Phase 3 and `docs/production-auth.md`.
  - Strength: Safe merge order, independent of branch timing.
  - Tradeoff: One more env var and one more branch to test.
  - Confidence: HIGH
  - Blind spot: The Login link test (4.3) must cover both flag states.
- **Fix B**: Keep the plan and add an explicit merge-order rule: 0.6 merges to `main` only in the same PR train as 0.7.
  - Strength: No code.
  - Tradeoff: Relies on discipline; blocks other work on the branch.
  - Confidence: MEDIUM
  - Blind spot: Hotfixes to `main` could carry it out early.
- **Decision**: FIXED (Fix A: PASSWORD_RESET_ENABLED flag, Login link hidden when off)

### F2 — The timing floor does not close the timing channel

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 items 1–2; Decisions table "Timing"
- **Detail**: `MIN_RESPONSE_MS` has no value and no provider timeout is named. A real SMTP send for a registered address can exceed the floor while an unknown email returns quickly, so response time reveals account existence. Paths also differ in limiter RPC count (1 to 3). The earlier lesson "named timeout on provider calls (5 s)" from `fix-expired-session-local-sign-out` is not applied.
- **Fix A ⭐ Recommended**: Run the `resetPasswordForEmail` call in Next's `after()` so response time no longer depends on the provider; keep a small floor only to level out limiter RPC variance. Check `node_modules/next/dist/docs/` (`after.md`) for Server Action support and caveats.
  - Strength: Removes the channel instead of masking it.
  - Tradeoff: Provider errors can only be logged, never shown (already the policy); tests must flush `after` callbacks.
  - Confidence: MEDIUM — confirm `after()` behavior in Server Actions on this Next version.
  - Blind spot: Vercel function lifetime for the deferred send.
- **Fix B**: Keep the floor, set it from measured p99 provider latency (value decided after the first CI run), and add a provider timeout below the floor.
  - Strength: Smaller change.
  - Tradeoff: Fragile; a slow provider day re-opens the leak.
  - Confidence: LOW
  - Blind spot: Latency differs between local Inbucket/Mailpit and real SMTP.
- **Decision**: FIXED (Fix A: provider call in after(); small floor kept for limiter variance; confirm after() in Server Actions)

### F3 — E2E will exhaust a single shared IP bucket

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 item 2 (`getClientIp` returns `"unknown"`); Phase 5 item 2
- **Detail**: Local and CI requests carry no `x-vercel-forwarded-for`, so all land in one `unknown` bucket of 5 per hour. The happy-path, unknown-email, repeat, resend and IP-exhaustion specs together exceed it, so later specs would see `rate_limited` unpredictably. The plan only says "a test IP header (if needed)". Trusting a forwarded header off Vercel is spoofable. Separately, in production a missing header puts all users into one bucket, which is a self-inflicted DoS.
- **Fix**: Decide the mechanism in the plan: honor a test IP header only when `E2E_TEST_HOOKS=1` (existing flag), give each spec a unique IP, and reserve one IP for the exhaustion spec. For production, define the missing-header behavior explicitly (looser dedicated bucket or fail-open on the IP rule, keeping the email rules).
- **Decision**: FIXED (test IP header only with E2E_TEST_HOOKS=1; looser dedicated unknown bucket in production)

### F4 — Anon-executable RPC can be filled with junk rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 item 4; "RPC exposure"
- **Detail**: HMAC keys stop anyone targeting a victim's bucket. They do not stop a caller with the public anon key creating unbounded new `(scope, key_hash)` rows. Cleanup deletes only rows idle past the retention window, so a flood inside the window grows the table.
- **Fix**: Allow-list `p_scope` inside the function, cap `p_key_hash` length, and document the residual risk. Add pgTAP cases for an unknown scope and an oversized key.
- **Decision**: FIXED (scope allow-list + key length cap + pgTAP cases)

### F5 — Stateless Supabase client for the provider call

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 items 2–3
- **Detail**: `createServerSupabaseClient` forces PKCE and sets a verifier cookie when it calls the provider. With `token_hash` that cookie is unused. The "byte-identical" assertion covers action state only, not headers or cookies, so the sent and email-limited paths differ by a `Set-Cookie` (not account-dependent, but needless).
- **Fix**: Inject a plain `createClient` with `persistSession: false` for this action and assert no cookies are written.
- **Decision**: FIXED (stateless client, no cookies)

### F6 — Missing hash secret silently disables sending

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: "Env" and Phase 3 item 3
- **Detail**: A missing or weak `RATE_LIMIT_HASH_SECRET` returns `sent` with no emails, so a misconfigured production looks healthy.
- **Fix**: Validate presence and minimum length at the config boundary, log a distinct safe code, and add it to the Phase 3 manual checklist (3.8) plus a post-deploy smoke step.
- **Decision**: FIXED (secret validation, distinct log code, smoke step)

### F7 — Reload behavior contradicts the research decision

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: research Open Question 9 vs Phase 4 item 1
- **Detail**: Research says the server retry-after is authoritative after reload. The plan renders only from action state, so a reload returns to the empty form (a resubmit returns `rate_limited` again, which does not consume a token).
- **Fix**: State the deliberate behavior in the plan ("reload resets the screen; server remains authoritative on resubmit") and align research wording.
- **Decision**: FIXED (reload behavior documented as deliberate)

### F8 — Phase 1 is "no behavior change" but changes the Signup heading

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 1 item 2, criterion 1.1
- **Detail**: Criterion 1.1 says Login/Signup tests pass unchanged, while item 2 promotes Signup's `<div>` heading to `<h1>` and allows editing tests. Login/Signup E2E cannot run locally, so unit tests are the only safety net until CI.
- **Fix**: Either drop the `<h1>` change from Phase 1 (do it in its own step) or reword 1.1 and grep `e2e/` for heading locators first.
- **Decision**: FIXED (Signup h1 moved to separate step 1.6)

### F9 — Shared-IP users and silent email limits have no feedback path

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: brief "Open Risks"; Phase 3 item 2
- **Detail**: Offices and campuses can hit the 5/hour IP wall. A silently email-limited user sees "Check Your Email" and gets nothing, by design. The email hourly ceiling (5) equals the IP ceiling (5), so it only adds value against distributed abuse.
- **Fix**: Log a safe `rate_limited` count so tuning is data-driven, and document the silent-limit behavior and the intent of the email ceiling in `docs/production-auth.md`.
- **Decision**: FIXED (safe rate_limited count + docs note)

### F10 — `redirectTo` is redundant with the template

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 item 4; "Link contract"
- **Detail**: The template uses `{{ .SiteURL }}` and a hard-coded `next=/reset-password`, so `redirectTo` is not part of the emailed link. Story 0.7's handler must never accept a user-supplied `next`.
- **Fix**: Document that `redirectTo` only satisfies allow-list validation, and add a 0.7 hand-off note: ignore or strictly allow-list `next`.
- **Decision**: FIXED (redirectTo note + 0.7 next hand-off)

### F11 — `supabase-test/` mirror is not on the forgot-password test path

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 4; Phase 3 item 4
- **Detail**: `supabase-test/` is only started by `e2e/session-expiry.spec.ts` (`supabase start --workdir supabase-test`). The new specs and pgTAP run against the root project. The mirrored migration, config and template are still required by `supabase/migrations/README.md` to avoid drift, but they are not what proves this feature.
- **Fix**: Keep the mirror (and the `diff` check 2.5), but note in the plan that CI evidence for 0.6 comes from the root project. Add `supabase/tests/database/` creation explicitly (the directory does not exist).
- **Decision**: FIXED (note added; supabase/tests/database creation explicit)

### F12 — Phases 2 and 3 can only be fully verified after a push

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: criteria 2.4, 3.6, 5.1
- **Detail**: pgTAP and `supabase start` run only in CI on Ubuntu, so failures surface late if CI is first observed in Phase 5.
- **Fix**: Add a note: push after Phases 2 and 3 and read the CI result before moving on. Also add the `supabase test db` step to the workflow in Phase 2, not Phase 5.
- **Decision**: FIXED (supabase test db step moved to Phase 2; push per phase)

## Triage summary

| Priority | Findings | Action |
|----------|----------|--------|
| Resolve before `/10x-implement` | F1, F2, F3 | Need a decision (Fix A recommended for F1 and F2) |
| Fold into phase contracts | F4, F5, F6 | Small plan edits |
| Clarify in plan text | F7, F8, F11, F12 | Wording and ordering |
| Note in docs | F9, F10 | `docs/production-auth.md`, Story 0.7 hand-off |
