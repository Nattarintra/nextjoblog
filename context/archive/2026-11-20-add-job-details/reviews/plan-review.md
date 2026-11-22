<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Add Job Details (Story 1.2)

- **Plan**: context/changes/add-job-details/plan.md
- **Mode**: Deep (inline verification, no sub-agent)
- **Date**: 2026-11-20
- **Verdict**: REVISE → SOUND (after triage fixes)
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING (fixed) |
| Lean Execution | WARNING (fixed) |
| Architectural Fitness | WARNING (fixed) |
| Blind Spots | PASS |
| Plan Completeness | FAIL (fixed) |

## Grounding
9/9 paths ✓ (new files excluded), 14/15 symbols ✓ (`isUuid` is new by design; `components/applications/` did not exist), change↔research↔plan ✓

## Findings

### F1 — Progress section does not map 1:1 to Success Criteria

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 2, 4, 7 and `## Progress`
- **Detail**: Phase 2 had 4 automated bullets vs 2 Progress steps; Phase 4 manual bullet had no step; Phase 7 CI bullet split across 7.1/7.2.
- **Fix**: Align criteria and Progress without renumbering.
- **Decision**: FIXED (Fix in plan)

### F2 — Detail page is unreachable after the post-save redirect

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 6; Phase 7 E2E
- **Detail**: `ApplicationRow.tsx` had no link to `/applications/{id}`; Edit is deferred, so the page was a dead end.
- **Fix A ⭐ Recommended**: Make the row title a `Link` to `applicationDetailPath(id)`.
- **Fix B**: Defer list→detail navigation and drop the e2e claim.
- **Decision**: FIXED (Fix A)

### F3 — `CONTENT_COLUMNS` redefinition widens the list query

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Ports and repository
- **Detail**: `LIST_COLUMNS` derives from `CONTENT_COLUMNS`; widening it adds six columns to every list row and mistypes `StoredContent`.
- **Fix**: Separate `IDEMPOTENCY_COLUMNS`; keep list on `FIELD_NAMES`; add list-select test.
- **Decision**: FIXED (Fix in plan)

### F4 — The DB-enum drift test cannot detect drift

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — `job-details` tests
- **Detail**: Test compared against a hand-copied enum list.
- **Fix**: Parse enums from the migration file.
- **Decision**: FIXED (Fix in plan)

### F5 — Plan size vs. scope

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phases 4 and 6
- **Detail**: `PostingLink` and `DefinitionList` extractions are optional.
- **Fix**: Keep `DefinitionList` route-local; `PostingLink` stays shared (hero is its second caller; href re-check in one place).
- **Decision**: FIXED (Fix in plan, partly: DefinitionList route-local)

### F6 — Path nit: `components/applications/PostingLink.tsx`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 6
- **Detail**: Directory did not exist; domain components live in the route's `_components/`.
- **Fix**: Use `app/(protected)/applications/_components/PostingLink.tsx`.
- **Decision**: FIXED (Fix in plan)
