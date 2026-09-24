<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Diagnose Production Signup and Login Failure

- **Plan**: context/changes/diagnose-production-auth-failure/plan.md
- **Mode**: Deep
- **Date**: 2026-09-24
- **Verdict**: APPROVE (all findings fixed in triage — see Decisions below)
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS (F1 fixed in triage) |
| Blind Spots | PASS (F2 fixed in triage) |
| Plan Completeness | PASS |

## Grounding

7/7 paths ✓ (`lib/supabase/server.ts`, `proxy.ts`, `app/actions/auth.ts:50-88/104-134`, `supabase/config.toml:154-184`, `__tests__/actions/session.test.ts` mock pattern, `e2e/session-expiry.spec.ts`, `package.json` scripts), 3/3 symbols ✓ (`email_not_confirmed`/`user_already_exists`/`invalid_credentials` exist in installed `@supabase/auth-js` `ErrorCode`; `signUp()` JSDoc confirms `session: null` when confirm-email is enabled and confirms the "obfuscated user, no session" response for an already-confirmed email — the plan's session-based branch correctly reuses Supabase's own anti-enumeration behavior rather than fighting it), research↔plan-brief↔plan ✓ (both evidence-backed causes — missing/malformed public env config, and unchecked `data.session` on signup — are addressed by name). Confirmed via `node_modules/next/dist/docs`: `proxy.ts` (not `middleware.ts`) is the correct v16 convention for this repo (Next 16.3.4), matching the plan's file target.

## Findings

### F1 — Shared Supabase config module contradicts the installed Next version's own "no shared globals in Proxy" guidance

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1, item 1 ("Shared Supabase runtime configuration") and item 3 ("Proxy configuration handling")
- **Detail**: The plan's core Phase 1 move is "one small runtime configuration boundary used by the server client and proxy" (`lib/supabase/config.ts`, imported from both `lib/supabase/server.ts` and `proxy.ts`). `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` states explicitly: "Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals." Proxy in this project's Next version defaults to the Node runtime, but the doc's caution is about Vercel's ability to run Proxy on a separate network tier from the render-time Node functions — sharing *mutable module-level state* (e.g., a cached/memoized validated-config singleton) between the two is exactly what the doc warns against, since that state won't actually be shared across the two execution contexts in an optimized deployment.
- **Fix ⭐**: Keep `lib/supabase/config.ts`'s getter a pure, side-effect-free function — no module-level caching of the validated URL/key or of any "have we already logged this failure" flag. Recompute from `process.env` on every call in both call sites. State this explicitly in the Phase 1 contract so whoever implements it doesn't add memoization as an "obvious" optimization.
  - Confidence: MEDIUM — the doc's warning is about optimized/edge deployment topology, not a hard runtime error in Node-runtime Proxy; but the plan gives no explicit signal to the implementer to avoid caching, so this is worth calling out rather than leaving implicit.
- **Decision**: FIXED (Fix in plan — Phase 1 item 1 contract now requires the config getter to be pure and re-read `process.env` on every call, with the Proxy-doc rationale stated inline)

### F2 — `e2e/session-expiry.spec.ts` duplicates the proxy's cookie-key derivation and is not in Phase 3's file list

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1, item 3 ("Proxy configuration handling") and Phase 3, item 3 ("Local E2E regression coverage")
- **Detail**: `proxy.ts:10` derives `authCookieStorageKey` from `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname` at module load. `e2e/session-expiry.spec.ts:13-14` independently re-implements the identical formula (`sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`) and uses it to decode/assert cookies across the entire spec (lines 89, 136, 191, 246, 310, 338). Phase 1's contract for the proxy only says to move config resolution to request time and "preserve... session-expiry cleanup... behavior" — it doesn't call out that the cookie-key derivation itself must stay byte-for-byte identical, and Phase 3's e2e item lists only `e2e/signup.spec.ts` and `e2e/login.spec.ts` as files in scope, omitting `e2e/session-expiry.spec.ts` even though it is the spec most exposed to a Phase 1 change. If Phase 1's request-time config boundary changes how or when the hostname-derived key is computed (e.g., a different validation/normalization step), this duplicated test helper would silently diverge from production behavior and only be caught by whatever remains of `npm run test:e2e`, not by anything called out in the plan's own phase success criteria.
- **Fix ⭐**: Add `e2e/session-expiry.spec.ts` to Phase 3 item 3's file list explicitly, with a contract line stating the cookie-key derivation formula must remain identical to today's, and add a Phase 1 automated-verification line asserting the derived key is unchanged for a representative URL (not just that config validation itself works).
  - Confidence: HIGH — grounded directly in the duplicated source lines; this is a real coupling the plan doesn't name.
- **Decision**: FIXED (Fix in plan — Phase 1 item 3 contract now pins the exact derivation formula and names `e2e/session-expiry.spec.ts` as the spec that would catch drift; Phase 1 automated verification adds a derivation-stability check; Phase 3 item 3 now lists `e2e/session-expiry.spec.ts` in scope with a contract line requiring its cookie-decoding assertions to keep passing unchanged)

## Notes

- Plan-brief's own flagged "Open Risks & Assumptions" item — "the exact hosted Supabase error code for unconfirmed email must be confirmed against the installed Auth SDK" — is already resolvable without live-project testing: `node_modules/@supabase/auth-js/dist/main/lib/error-codes.d.ts` lists `'email_not_confirmed'` as a stable `ErrorCode` value today. Not a finding; the plan can drop this from "must be confirmed live" to "confirmed via installed SDK types" and treat only the *hosted project's actual confirmation setting* as the remaining external unknown.
- The plan's decision to treat "signup with an already-registered, already-confirmed email" the same as "confirmation-required" when hosted confirmation is enabled (via the `data.session` branch) is correct, not a gap: Supabase's own `signUp()` JSDoc confirms it deliberately returns an obfuscated user with no session in that case specifically to prevent user enumeration, so the plan's UI copy for that state should stay generic ("check your email") rather than implying anything about whether the account is new.
- `.env.local` (gitignored, confirmed via `git check-ignore`) contains commented-out hosted-looking Supabase values alongside active local ones — consistent with, and supportive of, the research's core hypothesis that the deployment boundary was never made explicit. No action needed from this review; flagging only because it corroborates Phase 3's runbook rationale.
