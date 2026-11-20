<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Refresh Access (Story 0) UI

- **Plan**: context/changes/refresh-access-ui/plan.md
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE → SOUND after triage
- **Findings**: 1 critical, 7 warnings, 2 observations

## Verdicts

| Dimension | Initial | After triage |
|-----------|---------|--------------|
| End-State Alignment | WARNING | PASS |
| Lean Execution | PASS | PASS |
| Architectural Fitness | FAIL | PASS |
| Blind Spots | WARNING | PASS |
| Plan Completeness | WARNING | PASS |

All ten findings were fixed in plan.md, so every dimension now passes. Overall: REVISE → SOUND.

## Grounding
29/29 paths ✓, 5/5 symbols ✓, brief↔plan ✓. Progress structure ✓.

## Findings

### F1 — Rebasing PasswordInput on FormField/TextInput drops its a11y contract
- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §5
- **Detail**: PasswordInput uses role="alert", external describedBy, `warning` and caller ids; FormField supports none.
- **Fix B ⭐**: Keep PasswordInput markup/ARIA; reuse shared tokens only.
- **Decision**: FIXED (Fix B)

### F2 — ui/Dialog contract leaves decisions open
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §2
- **Detail**: Hook lives in app/(protected); light vs navy variant unresolved; ambiguous key props.
- **Fix**: Move hook to lib/hooks, `tone` prop, `onEscape` only.
- **Decision**: FIXED

### F3 — Close-before-Log Out breaks focus-trap refs
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2
- **Detail**: DOM order swap requires first/last ref swap.
- **Fix**: Swap refs, add Tab-wrap test.
- **Decision**: FIXED

### F4 — AuthLayout semantics
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4, Phase 3 §3
- **Detail**: No `<main>`; brand panel adds heading/list to queries and reading order.
- **Fix**: Form panel `<main>`, brand panel aria-hidden.
- **Decision**: FIXED

### F5 — Axe spec can't reach most screens
- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH
- **Dimension**: End-State Alignment
- **Location**: Phase 4 §2
- **Detail**: Stateful screens have no stated reach mechanism.
- **Fix A ⭐**: Screen-reach table, shared axe helper inside existing specs.
- **Decision**: FIXED (Fix A)

### F6 — Light-surface regression only checked by eye
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 1
- **Detail**: Contradictory "both surfaces" wording; no e2e in Phase 1.
- **Fix**: Remove wording, reference screenshots, e2e step 1.8.
- **Decision**: FIXED

### F7 — Test inventory incomplete
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §6, Phase 3
- **Detail**: route-guard.spec.ts, PasswordInput.test.tsx, border-auth-danger assertions, SessionExpiryNotice.test.tsx missing.
- **Fix**: Add to lists.
- **Decision**: FIXED

### F8 — Progress titles drift from bullets
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: ## Progress
- **Detail**: 12 titles paraphrased, commands lost.
- **Fix**: Copy bullets verbatim.
- **Decision**: FIXED

### F9 — Logout wording fits one of four failure states
- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3
- **Detail**: Only `stillSignedIn` should change.
- **Fix**: Name the constant.
- **Decision**: FIXED

### F10 — Next.js docs reading not a Progress step
- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Migration Notes
- **Detail**: AGENTS.md requirement was prose only.
- **Fix**: First action in Phase 1, Progress 1.9.
- **Decision**: FIXED
