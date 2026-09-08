<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log In to an Existing Account

- **Plan**: context/changes/log-in-an-existing-account/plan.md
- **Scope**: Full plan (Phase 1 of 3 through Phase 3 of 3)
- **Date**: 2026-09-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Email-shape regex duplicated instead of shared

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/actions/auth.ts:44,90
- **Detail**: The plan said "Reuse the same email-shape regex already used by signup." `signup` inlines `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` at line 44; `login` defines a second, independent literal `emailShapePattern` at line 90 with the identical pattern string rather than importing or referencing the same value. Output is currently identical, but the two literals can silently drift apart if either is edited later without the other being noticed.
- **Fix**: Hoist one `const emailShapePattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` above both `signup` and `login` and have both functions reference it, removing the duplicate literal.
- **Decision**: FIXED — shared `emailShapePattern` constant hoisted above both functions; verified with `tsc --noEmit`, `lint`, and `test:run` (14/14 passing).

## Verification Notes

- **Plan drift agent**: every planned file/contract item across all 3 phases verified MATCH — no drift, no missing items, no unplanned scope creep. Confirmed `app/signup/styles.ts` and `AuthLogo.tsx` were never modified (read-only reuse, as the plan required).
- **Safety/quality agent**: anti-enumeration correctly implemented (identical error for wrong password vs. unregistered email, no timing/status leaks); no client-side email lowercasing; `redirect()` correctly placed outside try/catch so it isn't swallowed; service-role key confined to test setup, never exposed client-side.
  - Agent flagged `LoginForm`/`LoginFields` importing from `app/signup/*` as a pattern-compliance concern — not carried forward as a finding since the plan explicitly sanctions this ("Cross-feature imports are read-only... Do not modify either file, and do not duplicate their contents").
  - Agent flagged duplicated `if (error) {...}` / `catch (error) {...}` bodies in `login` — not carried forward since this mirrors `signup`'s pre-existing convention exactly; not new debt introduced by this change.
- **Automated checks** (all run fresh): `npx tsc --noEmit` ✅, `npm run lint` ✅, `npm run build` ✅, `npm run test:run` ✅ (14/14 passed), plus all four grep-based success-criteria checks ✅.
- `npm run test:e2e` was not re-run (requires a live Supabase instance); the plan's Progress log already shows it passing with a recorded commit SHA (270dc33) and manual Playwright-report confirmation (6502245).
