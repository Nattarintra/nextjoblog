<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log a New Application with Required Fields (Story 1.1)

- **Plan**: context/changes/log-a-new-application-with-required-fields/plan.md
- **Scope**: Full plan, Phases 1–8 of 8
- **Date**: 2026-11-19
- **Verdict**: NEEDS ATTENTION (at review time; all findings triaged and resolved, see Decisions)
- **Findings**: 0 critical, 6 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Client submit swallows every rejection, including redirects

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: lib/applications/client-submit.ts:30-34
- **Detail**: Bare `catch {}` mapped the redirect rejection after a successful save to the "save failed" state.
- **Fix**: Rethrow Next control-flow errors with `unstable_rethrow`; unit test added.
- **Decision**: FIXED (Fix now; `unstable_rethrow` from `next/navigation`)

### F2 — Scroll lock is lost when Account opens from the drawer

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: app/(protected)/_components/useNavDrawer.ts, AccountSheet.tsx
- **Detail**: Lock lived only while the drawer was mounted; the real scroller is the main column.
- **Fix**: `useBodyScrollLock` in the shell for drawer, account and expiry notice; main column becomes `overflow-hidden` while locked.
- **Decision**: FIXED (Fix now). `inert` on the main content not added (optional follow-up).

### F3 — Applications list is unbounded

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: lib/applications/repository.ts:72-83
- **Detail**: `list()` had no limit.
- **Fix A ⭐ Recommended**: Hard cap constant.
- **Decision**: FIXED via Fix A (`LIST_PAGE_SIZE = 50`, info alert when reached; noted in plan addenda)

### F4 — Validation rules and focus hook differ from the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Plan Adherence
- **Location**: lib/applications/validation.ts:14-25, useApplicationForm.ts:13-21
- **Detail**: `Record<FieldName, FieldRule>` instead of `FieldRule[]`; focus hook inline instead of its own reusable file.
- **Fix A ⭐ Recommended**: Document as plan addenda.
- **Decision**: FIXED via Fix A (plan `## Addenda`)

### F5 — `change.md` was not updated in Phase 8

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: context/changes/log-a-new-application-with-required-fields/change.md
- **Detail**: Status still `plan_reviewed`.
- **Fix**: Set `status: impl_reviewed`.
- **Decision**: FIXED

### F6 — Raw hex colours in `StatusBadge`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: components/ui/StatusBadge.tsx:6-8
- **Detail**: Five hex values with no tokens, against the Phase 1 "no raw hex" contract.
- **Fix**: Tokens in `globals.css`, used by `StatusBadge`.
- **Decision**: FIXED

### F7 — Migration has no backfill or rollback script

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261119100000_application_defaults_and_history_trigger.sql
- **Detail**: Pre-trigger rows have no first history row. Documented as intended in the plan.
- **Fix**: New forward-only backfill migration (current status at `created_at`), copied to `supabase-test/`, with pgTAP test.
- **Decision**: FIXED (user chose to add it despite the caveat that no pre-existing rows are likely)

### F8 — `lib/applications` depends on `lib/auth` internals

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: lib/applications/log.ts, lib/applications/log-application.ts
- **Detail**: Borrowed `describeAuthError` / `AuthLogDetails`.
- **Fix**: Neutral `lib/logging/error-details.ts`; `lib/auth/error-details.ts` re-exports the old names so auth code is untouched.
- **Decision**: FIXED

### F9 — A second `id_conflict` on retry is not logged

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: lib/applications/log-application.ts:56-67
- **Detail**: Unreachable-in-practice path fell through silently.
- **Fix**: Log `applications.log.id_conflict_after_retry`.
- **Decision**: FIXED

### F10 — Static no-SQL test has a narrow scan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: __tests__/lib/applications/no-raw-sql.test.ts
- **Detail**: Did not scan the route folder.
- **Fix**: Recursive scan of `lib/applications` and `app/(protected)/applications`.
- **Decision**: FIXED
