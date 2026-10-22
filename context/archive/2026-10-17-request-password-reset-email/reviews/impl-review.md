<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Request a Password Reset Email

- **Plan**: context/changes/request-password-reset-email/plan.md
- **Scope**: Phases 1–5 of 5
- **Date**: 2026-10-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Verification

- Full local unit suite after F9/F10: 50 files, 320 tests passed with coverage gates.
- TypeScript and lint passed.
- Migration copies are identical.
- The database-test rerun is green after commit `f799bbb` changed the stale-row cleanup test to consume a different key.
- The recorded Playwright run `39592028769` is green for commit `717b2c3`, but predates F9/F10 and the database-test fix.

## Findings

### F1 — Silent-limit paths still schedule email delivery

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: `lib/auth/request-password-reset.ts:144-177`
- **Detail**: Email cooldown, hourly-limit, and limiter-failure paths return neutral `sent`, but shared post-processing still schedules `runProviderCall`. This violates the plan’s requirement to skip provider delivery for silent limits and fail closed on limiter failure.
- **Fix**: Return an explicit “do not send” outcome from the orchestration step and schedule the provider only for an allowed request.
  - Strength: Restores the anti-spam and fail-closed contracts directly.
  - Tradeoff: Requires a small result-type refinement and test updates.
  - Confidence: HIGH — the current control flow demonstrably schedules the callback.
  - Blind spot: None significant.
- **Decision**: FIXED — explicit `shouldScheduleProvider` decision; regression tests verify silent-limit and limiter-failure paths do not schedule the provider.

### F2 — Resend cooldown does not reset

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `app/forgot-password/ResendLinkForm.tsx:16-22`
- **Detail**: `useCountdown(60)` initializes once. After a successful resend, the component remains mounted with the countdown at zero, enabling another resend immediately.
- **Fix**: Remount or restart the countdown whenever a new request completes.
  - Strength: Enforces the planned 60-second resend behavior.
  - Tradeoff: Requires passing a request-generation key or reset signal through the flow.
  - Confidence: HIGH.
  - Blind spot: The server limiter remains authoritative, but the client UX is currently incorrect.
- **Decision**: FIXED — added a resend generation key so `ResendLinkForm` remounts and restarts its cooldown after each `sent` action; added a regression test.

### F3 — Supabase RPC rejection is not converted to the typed limiter error

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `lib/auth/supabase-rate-limiter.ts:46-57`
- **Detail**: Malformed successful responses become `RateLimiterUnavailableError`, but a rejected `client.rpc()` promise escapes as the original error. This violates the adapter contract.
- **Fix**: Wrap the RPC call in `try/catch` and rethrow `RateLimiterUnavailableError`.
  - Strength: Preserves the use case’s fail-closed error boundary.
  - Tradeoff: Minimal.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — wrapped rejected RPC promises as `RateLimiterUnavailableError` and added a regression test.

### F4 — E2E parity claims are not fully tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `e2e/forgot-password.spec.ts:55-84`
- **Detail**: The unknown-email test clears the mailbox after submission instead of asserting it stayed empty. The repeated-request test submits only once per address, and no real provider-429 scenario is covered.
- **Fix**: Assert unknown-mailbox emptiness with a bounded wait and add CI coverage for provider throttling across known and unknown addresses.
  - Strength: Verifies the core anti-enumeration evidence required by the plan.
  - Tradeoff: More CI execution time and provider setup complexity.
  - Confidence: HIGH.
  - Blind spot: Actual Supabase provider behavior still needs CI confirmation.
- **Decision**: FIXED — added bounded mailbox-empty assertions for unknown addresses and made the repeated-request spec submit twice per address. Real provider-429 behavior remains an explicit CI/provider verification gap; unit coverage still verifies neutral mapping.

### F5 — Test IP header can be enabled in production

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `lib/auth/client-ip.ts:20-25`, `app/actions/password-reset.ts:34,61`
- **Detail**: Any deployment with `E2E_TEST_HOOKS=1` accepts the client-controlled `x-e2e-client-ip`, allowing limiter-bucket selection.
- **Fix**: Enforce test hooks as non-production-only and verify the trusted Vercel IP boundary before accepting forwarded headers.
  - Strength: Prevents configuration mistakes from becoming a limiter bypass.
  - Tradeoff: Adds an environment guard and deployment assumption.
  - Confidence: HIGH.
  - Blind spot: The exact production proxy topology was not independently verified.
- **Decision**: FIXED — reused the shared production-safe `isE2eHooksEnabled` gate and added explicit production/non-production tests.

### F6 — Missing site URL silently reports success

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `app/actions/password-reset.ts:30-36`
- **Detail**: Missing `NEXT_PUBLIC_SITE_URL` returns `{ status: "sent" }` without logging. Users see success while no provider request is scheduled.
- **Fix**: Validate the site URL at the configuration boundary and emit a safe configuration event before returning neutral state.
  - Strength: Makes deployment misconfiguration observable without leaking account state.
  - Tradeoff: Requires a small config-validation path.
  - Confidence: HIGH.
  - Blind spot: Hosted environment values were not independently checked.
- **Decision**: FIXED — added pure HTTP(S) site-URL validation, safe `missing_site_url`/`invalid_site_url` logging, and action tests confirming no client or provider setup.

### F7 — Limiter RPC has unresolved resource and reliability risks

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20261020100000_create_rate_limit_buckets.sql:46-51`, `lib/auth/supabase-rate-limiter.ts:46-57`
- **Detail**: Anonymous callers can create arbitrary unique bucket rows during the seven-day retention window, and limiter RPC calls have no explicit timeout.
- **Fix**: Add a bounded RPC deadline and document/enforce an operational row-growth safeguard.
  - Strength: Addresses both request availability and database-growth risk.
  - Tradeoff: Requires choosing timeout and cleanup/cardinality policy.
  - Confidence: MEDIUM — the plan documents residual flood risk but does not bound it fully.
  - Blind spot: Expected production request volume is unknown.
- **Decision**: FIXED — added a named 2-second limiter RPC deadline with typed failure mapping; restricted bucket keys to 64-character lowercase SHA-256 hex, added a concurrency-safe 10,000-row-per-scope cap with seven-day pruning, mirrored the migration into `supabase-test`, and documented capacity monitoring. Unit coverage passes; database verification remains pending because local Supabase/Postgres was unavailable.

### F8 — CI and manual evidence is claimed but not recorded

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `context/changes/request-password-reset-email/plan.md:472-478`
- **Detail**: CI and Playwright evidence is now recorded, and the corrected database-test run is green. Provider-429 behavior and hosted redirect/secret configuration remain separate provider/manual evidence gaps.
- **Fix**: Record the authoritative CI run ID, report artifact, and evidence for hosted configuration checks.
  - Strength: Makes the checked-off success criteria auditable.
  - Tradeoff: Documentation-only once the evidence exists.
  - Confidence: HIGH.
  - Blind spot: GitHub Actions state is not connected to the local repository evidence.
- **Decision**: ACCEPTED RISK — the Playwright evidence is auditable and green, and the database-test fix in `f799bbb` has passed CI. Provider-429 behavior and hosted redirect/secret configuration remain separate provider/manual evidence gaps.

### F9 — Story 0.7 hand-off and limiter telemetry are incomplete

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `docs/production-auth.md:57-61`, `context/changes/request-password-reset-email/change.md:48-52`, `lib/auth/request-password-reset.ts:130-132`
- **Detail**: Production docs omit the confirm URL and several planned recovery-session/`next` hand-offs. The IP rate-limited branch also lacks the planned safe rate-limit telemetry.
- **Fix**: Complete the Story 0.7 hand-off documentation and log a safe IP-limit event.
- **Decision**: FIXED — documented the final Story 0.7 hand-off (fixed confirm route, token verification, password validation/update, expired/used-link recovery, recovery-session boundary, and post-success session decision) in `docs/production-auth.md`; added the safe `auth.password_reset.rate_limited` event with no IP/email details and a regression assertion. The feature remains gated in Production until Story 0.7 ships.

### F10 — Unrelated session-expiry changes are included in the branch diff

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `proxy.ts`, `e2e/helpers/auth-session.ts`, related session-expiry files
- **Detail**: These changes come from an unrelated commit in the review range and are outside the password-reset plan.
- **Fix**: Separate the unrelated commit before merging, or document the intentional bundling.
- **Decision**: FIXED — documented the intentional bundling of `dd4d31a` in `plan.md`: it stabilizes shared auth/session behavior and the E2E session helper used by the branch, while remaining outside the password-reset acceptance criteria. Local unit, lint, and typecheck gates are used to verify the bundled changes; Supabase/Playwright remain CI-only.
