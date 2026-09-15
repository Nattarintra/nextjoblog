<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Stay Logged In Across Browser Sessions

- **Plan**: context/changes/stay-logged-in-across-browser-sessions/plan.md
- **Mode**: Deep
- **Date**: 2026-09-11
- **Verdict**: REVISE (all findings fixed in triage — see Decisions below)
- **Findings**: 2 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | PASS |

## Grounding

6/6 paths ✓ (proxy.ts, lib/supabase/server.ts, supabase/config.toml:270-275, app/actions/auth.ts:88/134, vitest.config.mts, app/dashboard confirmed absent as claimed), 4/4 symbols ✓ (getClaims/amr shape, AuthSessionMissingError, session_expired/session_not_found error codes, @vitest/coverage-v8@4.1.11 exists), brief↔plan ✓

## Findings

### F1 — Phase 6's "alternate config file" mechanism doesn't exist in the installed Supabase CLI

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 6, item 1 — Short-timebox local test config
- **Detail**: Phase 6 proposes `supabase/config.test.toml` as a sibling file, "started via a separate `supabase start --workdir` or config-path invocation." Ran `supabase start --help` and `supabase --help` against the installed CLI (v2.116.0): there is no `--config`/config-path flag. `--workdir` takes a whole *project directory* (expected to contain its own `supabase/config.toml`, migrations, seed data), not a way to point at a single alternate `.toml` file inside the same project. As written, Phase 6's entire "real GoTrue enforcement" e2e test — and Phase 2's "cookie-tampering e2e test (Phase 6)" success criterion, which depends on it — has no working invocation path.
- **Fix A ⭐ Recommended**: Maintain a second minimal Supabase project directory (e.g. `supabase-test/`) with its own short-timebox config, migrations, and seed, run via `supabase start --workdir supabase-test`
  - Strength: Uses `--workdir` the way the CLI actually supports it; keeps the short-timebox stack fully isolated from dev.
  - Tradeoff: Duplicated project scaffolding (migrations must be kept in sync with `supabase/migrations/`) and a second Docker stack running during that e2e job.
  - Confidence: HIGH — verified directly against the installed CLI's flag set.
  - Blind spot: Migration drift between the two directories over time is a new maintenance burden not present today.
- **Fix B**: Script the test to overwrite `supabase/config.toml` with the short-timebox variant, `supabase start`, run the test, then restore the original file
  - Strength: No duplicated project directory or Docker stack.
  - Tradeoff: Mutates a tracked file as a side effect of a test run — fragile if the test crashes before restore, and racy if `npm run test:e2e` and `npm run dev` could ever run against the same local stack concurrently.
  - Confidence: MEDIUM — mechanically works, but "temporarily mutate a committed config file" is the kind of thing that bites during a failed CI run.
  - Blind spot: Interaction with `reuseExistingServer` in `playwright.config.ts` (dev server may already be running against the normal-timebox stack) not worked out.
- **Decision**: FIXED (Fix A)

### F2 — The "responded" cookie's own lifecycle contradicts the Happy Path it needs to survive

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4, item 1 — Notice component (Contract)
- **Detail**: The Contract states the `responded` cookie is "scoped to the current session (cleared naturally on next login since a new session mints a new cookie)" and is written via `document.cookie` with no Max-Age mentioned. A `document.cookie` write with no explicit `max-age`/`expires` creates a browser-session cookie — cleared when the browser closes, not when the user next logs in. But Happy-Path AC1 is exactly "close the tab or browser... and reopen the app later" while still inside the 30-day window — which includes reopening during the day-28–30 notice window. If the user answers (or dismisses) the notice on day 28, then closes and reopens the browser before day 30 (the scenario this story's own Happy Path is built to support), the flag cookie is wiped and `getNoticeState` will show the modal again on the next mount — directly contradicting Desired End State ("once answered... it does not reappear for that session") and the plan brief's success-criteria summary ("sees the... notice exactly once until they respond"). The stated rationale (cleared "on next login") only holds for a cookie that survives a browser restart.
- **Fix ⭐**: Give the `responded` cookie an explicit `max-age`/`expires` computed from the already-available `sessionExpiresAt` prop (e.g. `expires=sessionExpiresAt`), so it survives browser restarts for the remainder of the session's real life and still naturally disappears once the session itself would be gone (or is overwritten by a fresh session on next login).
- **Decision**: FIXED (Fix in plan)

### F3 — Hand-rolled cookie clearing ignores @supabase/ssr's chunked cookie naming

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2, item 1 — Proxy expiry branch (Contract)
- **Detail**: The contract calls for `response.cookies.delete(...)` "for the Supabase auth cookie names," implying a small fixed set of literal names. But `@supabase/ssr` (installed at `node_modules/@supabase/ssr`) chunks large auth cookies into `sb-<project-ref>-auth-token.0`, `.1`, etc., and already ships `isChunkLike`/`clearAuthCookiesAtScopes` specifically to enumerate and clear them correctly — unreferenced by the plan. A hand-rolled delete-by-fixed-name would silently no-op on chunked cookies, leaving stale (functionally inert, since the server-side session really is dead) cookies behind — a correctness footgun for whoever implements this without knowing about chunking.
- **Fix**: In Phase 2's implementation, enumerate the actual cookie names present on the request via `getAll()` filtered by the auth cookie's storage-key prefix (mirroring `isChunkLike`'s approach) rather than a fixed literal list, or reuse `clearAuthCookiesAtScopes`'s enumeration logic directly.
- **Decision**: FIXED (Fix in plan)

## Notes

Two techniques the plan flags as its own open risks were spot-checked and confirmed sound as described (not new findings):
- `amr[0].timestamp` as session-start proxy: confirmed shape in `@supabase/auth-js`'s `getClaims()` JSDoc example.
- `getClaims()` surfacing a distinguishable "confirmed expired" error: confirmed `session_expired`/`session_not_found` are real, distinct `ErrorCode` values, and `__loadSession()`'s refresh-failure path does propagate such errors up through `getSession()`/`getClaims()` rather than silently returning `session: null`.
