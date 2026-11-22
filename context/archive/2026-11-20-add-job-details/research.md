---
date: 2026-11-20
git_commit: 99eaec781218065f8174779bc8d44dd92b945a84
branch: feat/add-job-details
repository: nextjoblog
topic: "Add job details (Story 1.2): optional fields on the application form and detail page, reusing existing UI kit"
tags: [research, applications, forms, supabase, tailwind, a11y, testing]
status: complete
---

# Research — add-job-details (Story 1.2)

Scope: optional job-details fields on the application form, stored and shown on the detail page. Inputs: `change.md`, design section "02 · APPLICATIONS — FEATURE 1" (`supabase/docs/nextjoblog-mvp-screens.html`), `supabase/docs/nextjoblog-supabase-schema-en.md`, the current codebase.

## 1. What exists today

| Area | State |
| --- | --- |
| Routes | `/applications` (list), `/applications/new` (form). **No detail page and no edit page.** |
| Form | `ApplicationForm` → `ApplicationFormFields` (5 required fields; already has an `optionalSection?: ReactNode` slot reserved for this story) → `useApplicationForm` (React 19 `useActionState`, remounts fields per submission). |
| Server Action | `app/actions/applications.ts` → `logApplication` service (validate → normalize → `writer.insert`), idempotent via `client_id`. |
| Domain | `lib/applications/`: `types.ts` (`FIELD_NAMES` = 5 required, `ApplicationFormValues = Record<FieldName,string>`), `validation.ts` (`REQUIRED_FIELDS` rule table), `form-data.ts`, `form-view.ts`, `ports.ts` (`ApplicationWriter`, `ApplicationReader`), `repository.ts` (explicit insert allow-list), `messages.ts`, `limits.ts`, `dates.ts`. |
| UI kit (`components/ui/`) | `FormField` (context-based id/aria wiring), `TextInput`, `DatePicker`, `Card`, `SectionLabel`, `Alert` (has a `warning` tone), `StatusBadge`, `Button`, `PageHeader`, `ErrorSummary`, `Icon`. |
| Tests | Vitest + RTL under `__tests__/`; global coverage gate 80%, `lib/applications/**` and `lib/auth/**` gate 90% (`vitest.config.mts`). SQL tests in `supabase/tests/database/`. E2E + axe in `e2e/`. |
| Docs | `docs/applications.md` already says: "Story 1.2: pass `optionalSection` to `ApplicationFormFields`, extend `FieldName`/validation, add columns to the repository's insert and select lists." |

## 2. Design (section 02) — what Story 1.2 needs

Form, "Job details · optional" card (`form-body` template), two-column grid:

- **Closing date** — date field + inline warning (`field-warn`, `role="status"`, warning icon): "Closing date is before the applied date — double check (you can still save)".
- **Salary** — free text, placeholder "e.g. 45,000–52,000 SEK/month".
- **Work arrangement** — single-select pill row: On-site / Hybrid / Remote.
- **Contract type** — pills: Permanent / Fixed-term / Consultant / Internship.
- **Track** — pills: Frontend / Fullstack / Backend / Tester/QA.
- **Required technologies** — tag input: chips with remove (✕, `aria-label="Remove React"`), text input "Add a technology, then press Enter".

Detail page (`detail-main`): hero card (title, company, status badge, chips), then "Job details" card as a `<dl class="kv">` with rows Closing date / Work arrangement / Contract type / Track / Technologies (chips) / Salary; an unset value renders `—` (`empty-val`). The Edit screen reuses `form-body` verbatim, and "Changes saved" toast follows save.

## 3. Database (schema doc vs. migrations) — findings

1. **Columns already exist** in `applications`: `closing_date date`, `work_format`, `contract_type`, `discipline` (enums), `tech_stack text[] not null default '{}'`, `salary_info text`. RLS and the `applications_owner` policy already cover them. No new columns are needed.
2. **Enum mismatch — decision needed.** Design offers "Fixed-term"; the `contract_type` enum is `permanent | consultant | internship | contract`. Either map "Fixed-term" ↔ `contract` (label only, no migration) or add a value via migration. Recommended: label mapping (`contract` → "Fixed-term"), zero DB change.
3. **Schema drift.** The schema doc says `source_website`, `fit_rating`, `fit_reason`, `missing_skills` were removed, but the migrations (`20260902082510_create_tables.sql`) still create them and no migration drops them. Not blocking for 1.2 (we never select them), but a cleanup migration is owed (the doc's own "Migration" block). Treat as a separate/optional task; flag to the owner.
4. **No DB constraint** for `closing_date < applied_date` (by design): warning only, in the app layer.
5. `tech_stack` has no length/duplicate constraints → enforce in the app (see §5).
6. Enum display labels `work_format`: `on_site` → "On-site", etc. UI value ↔ DB value mapping belongs in one table in `lib/applications/`.

## 4. Gaps against the acceptance criteria

| AC | Gap |
| --- | --- |
| Optional fields saved and "shown on the application detail page" | The detail page does not exist (design: `scr-detail`). Needs `app/(protected)/applications/[id]/page.tsx` (read side) and a repository `get(id)`. Dependency "Story 1.1" only delivered create + list. |
| "creating **or editing**" | Edit screen does not exist (no update port, no update action). Decide scope — see Open questions. |
| Predefined options, not free text | Needs a single-select pill group component (a11y: `role="radiogroup"` + `role="radio"`/native radios, arrow-key navigation, ability to deselect since fields are optional). |
| Technologies as separate removable tags | Needs a `TagInput` component; submitted as repeated `tech_stack` form entries (`formData.getAll`). |
| Closing-date warning appears/disappears live | Needs client-side derived state from two inputs (applied date, closing date). `DatePicker` already exposes `onChange`; applied_date lives in an uncontrolled sibling → lift the pair into one small client component/hook. |
| Closing date optional ⇒ must be clearable | `DatePicker` currently cannot clear a value (`handleSelect` ignores `undefined`). Needs a clear affordance. |

## 5. Reuse analysis

Reuse as is: `Card`, `SectionLabel` (needs an "optional" `hint` — already supported via `hint`), `FormField`, `TextInput` (salary), `DatePicker` (closing date), `Alert tone="warning"` or a smaller inline warning, `Icon` (`alert`), `Button`, `StatusBadge`, `PageHeader` (detail + edit headers), `ErrorSummary`, `fieldId`.

Extend: `DatePicker` (+ clear, + optional `min`-less), `Icon` (add `edit`, `trash` only if the detail header lands; not needed for form), `messages.ts`, `types.ts`, `validation.ts`, `form-data.ts`, `form-view.ts`, `repository.ts`, `log-application.ts`, `ApplicationFormFields` (fill `optionalSection`), `ApplicationFormView` plumbing.

New (generic UI kit, `components/ui/`): 
- `ChoiceGroup` (pill single-select; props: `options`, `defaultValue`, `name` via `FormField` context; no domain knowledge).
- `TagInput` (chips + input; Enter/comma adds, Backspace on empty removes last, each chip has a remove button with `aria-label`; live-region announcement on add/remove).
- `InlineNotice`/`FieldWarning` (warning text under a field, `role="status"`; distinct from error — does not block submit, does not set `aria-invalid`).
- `DefinitionList` / `DefinitionRow` (detail page `dl`, with `—` fallback).
- `Chip` (read-only chip, shared by TagInput and detail view).

New (domain, `lib/applications/`):
- `job-details.ts` — option tables (`WORK_FORMAT_OPTIONS`, `CONTRACT_TYPE_OPTIONS`, `DISCIPLINE_OPTIONS`: `{ value, label }`), type guards, one source of truth for form + detail + validation.
- `closing-date.ts` — pure `isClosingBeforeApplied(applied, closing): boolean` (ISO strings compare lexicographically once both are valid).
- `tech-tags.ts` — pure `addTag(tags, raw)` (trim/NFC, reject empty, case-insensitive dedupe, max length/count) and `removeTag`.

New (routes): `app/(protected)/applications/[id]/page.tsx` + `_components/ApplicationDetail*.tsx`, using `params: Promise<{ id: string }>` (Next 16: `await params`) and `notFound()` for missing/invalid id (design `scr-not-found`).

## 6. Proposed architecture (SOLID mapping)

- **Types**: split `FieldName` into `REQUIRED_FIELD_NAMES` and `OPTIONAL_FIELD_NAMES`; keep required-only validation behaviour unchanged (OCP: add a second rule table `OPTIONAL_FIELDS` and merge). `ApplicationFormValues` becomes `{ required..., optional... }` with `tech_stack: string[]` (the only non-string value) — consider `RequiredFormValues & OptionalFormValues` so the existing 5-field code and tests are untouched.
- **Validation (pure)**: optional fields validated only when non-empty: `closing_date` valid ISO; enums in allow-list; `salary_info` ≤ `MAX_TEXT_LENGTH`, no control chars; tags ≤ `MAX_TAG_COUNT` and each ≤ `MAX_TAG_LENGTH` (new constants in `limits.ts`, no magic numbers). Empty → `null` in the record. The closing-before-applied check is **not** a validation error (returns a warning only).
- **Persistence**: `NewApplicationRecord` gains nullable optional columns; `toInsertRow` allow-list extended (mass-assignment guard remains). `hasSameContent` / `classifyExistingRow` (idempotency) must compare the new columns too, otherwise a retry with different optional values would be wrongly treated as `already_exists`.
- **Read side**: new port `ApplicationDetailReader { get(id): Promise<ApplicationDetail | null> }` (ISP; list stays narrow). Repository `select` of the detail columns only.
- **Server Action**: `readApplicationFormData` reads optional fields (`getAll("tech_stack")`). Action stays a thin adapter. Redirect target after create: list today; with a detail page, redirect to `/applications/{id}` (design: Save → detail) — flag as a decision.
- **UI state**: form fields remain uncontrolled except the closing-date warning, which needs applied/closing values: encapsulate in `useClosingDateWarning(appliedDate, closingDate)` (pure function under the hood) inside a small `JobDetailsSection` client component. `ApplicationFormFields` only passes `optionalSection={<JobDetailsSection …/>}`.
- **Edit** (if in scope): `updateApplication` writer method + `updateApplicationAction`; reuse `ApplicationForm` with `mode`/initial values (DRY with design: Edit uses the same `form-body`).

## 7. Accessibility checklist

- Pills: `role="radiogroup"` with an accessible name from the field label; roving tabindex + arrow keys; selected state via `aria-checked`; pressing the selected option again clears it (optional field). Colour is not the only selected indicator (check mark / filled style), contrast ≥ 4.5:1.
- Tag input: input labelled by `FormField`; each remove button `aria-label="Remove React"`; add/remove announced via a polite live region; chips list is a `<ul>`; Enter must not submit the form while the tag input is focused with text.
- Warning: `role="status"`, icon `aria-hidden`, text `--warning-text` on `--warning-tint` (verify contrast with axe), linked by `aria-describedby` to the closing-date control; not `role="alert"` (not an error).
- Detail page: `<dl>/<dt>/<dd>`, `—` rendered with an accessible name ("Not provided") for screen readers; headings hierarchy `h1` page / `h2` sections (existing `SectionLabel` renders `h2`).
- Touch targets ≥ 44 px (matches `controlClassName` min-h-[44px]).

## 8. Test plan (target ≥ 80% overall; `lib/applications/**` stays ≥ 90%)

Unit (pure, table-driven): `closing-date` (before/equal/after/empty/invalid), `tech-tags` (trim, dedupe, case, empty, limits, remove), `job-details` option tables & guards, extended `validation`, `form-data` (`getAll`, unknown enum values dropped), `form-view`, `log-application` (optional values persisted/normalized, empty → null, unknown enum rejected), `repository` (insert row includes columns; idempotency compares optional fields; `get(id)` not-found / error).
Component (RTL + user-event): `ChoiceGroup` (click, arrows, deselect, name posted), `TagInput` (Enter adds, ✕ removes, duplicate, Backspace, Enter doesn't submit), `FieldWarning`, `JobDetailsSection` (warning appears for 25 Aug / 20 Aug, disappears when changed to ≥ applied or cleared — the two edge-case ACs verbatim; still submits), `DatePicker` clear, detail page (values, `—` placeholders, chips, not-found), form integration (save with optional fields posts expected FormData).
SQL (`supabase/tests/database/`): optional columns round-trip, `tech_stack` default `{}`, RLS isolation on new columns.
E2E (`e2e/applications.spec.ts`): fill optional fields → Save → values on detail page; closing-date warning flow; axe scan on form and detail.

## 9. Risks

- Idempotent-retry logic (`hasSameContent`) silently regressing for optional fields (see §6).
- `ApplicationFormValues` change ripples to ~10 files and 2 test files; keep required-only types intact via intersection to limit blast radius.
- React 19 resets uncontrolled inputs after an action; `ChoiceGroup`/`TagInput` state must be re-seeded from `values` (the existing `key={submission}` remount handles it, but tag state must initialise from `defaultValue`).
- Time zone: closing/applied dates are plain ISO dates; compare as strings only after `isValidIsoDate`.
- Next.js version has breaking changes (AGENTS.md): before implementing `[id]` and the action, re-read `node_modules/next/dist/docs/01-app/` pages on dynamic routes, `notFound`, and mutating data (params is a Promise in this version).

## 10. Decisions (Natta, 2026-11-20 — all recommendations accepted)

1. Scope: create + minimal read-only detail page in this change; Edit deferred to its own change.
2. After Save, redirect to the new detail page `/applications/{id}`.
3. "Fixed-term" is a label for enum `contract`; no enum migration.
4. Legacy-column cleanup migration (`source_website`, `fit_*`, `missing_skills`) is a separate change, not part of this one.
5. Tag limits: max 20 tags, 40 characters each, de-duplicated case-insensitively (first spelling kept).

## Open questions (resolved above, kept for history)

1. **Scope of "detail page" and "edit"**: build the minimal detail page now (read-only, Job details card + hero) and defer Edit to its own story, or include Edit? Story AC text says "creating or editing". Recommendation: create + detail page in this change; Edit as the next change (reuses everything built here).
2. **After Save redirect**: list (today) or new detail page (design)? Recommendation: detail page once it exists.
3. **"Fixed-term"** label vs enum `contract` (recommend label mapping, no migration).
4. **Drop legacy columns** (`source_website`, `fit_*`, `missing_skills`) in a cleanup migration — in this change or separate?
5. Tag limits (suggest max 20 tags, 40 chars each) and whether tags are case-insensitively de-duplicated (suggest yes, keep first spelling).
