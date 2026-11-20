# Add Job Details (Story 1.2) Implementation Plan

## Overview

A signed-in Job Seeker can add optional job details (closing date, salary, work arrangement, contract type, track, required technologies) when logging an application. After Save they land on a new read-only detail page `/applications/{id}` that shows the hero (title, company, status, chips) and a "Job details" card. The closing-date warning ("Closing date is before the applied date — double check (you can still save)") appears and disappears live and never blocks Save.

Engineering rules from the invocation, applied to every phase:

- **No hard-coded values, DRY:** option lists, labels, limits, messages, paths and column names each live once (`lib/applications/*`). The form, the validator, the repository and the detail page all read the same tables.
- **SOLID:** pure modules for rules; `logApplication(deps, input)` keeps its injected writer; a new narrow `ApplicationDetailReader` port (ISP); UI kit components know nothing about applications (policies are injected); new fields are added by data (`CHOICE_FIELDS`, `OPTIONAL_FIELDS`, `JOB_DETAIL_ROWS`), not by editing branches (OCP).
- **Clean code:** self-documenting names, no magic numbers, no clever hacks (no click-again-to-deselect trick, no regex golf).
- **Testability:** pure functions, injected clock/ids/writer/reader, no hidden globals.
- **Coverage:** ≥ 80% global (existing gate) and ≥ 90% for `lib/applications/**` (existing gate); every new unit gets tests in the same phase (TDD).
- **a11y:** semantic HTML (`fieldset`/`legend`, `ul`, `dl`), ARIA labels, keyboard operation, contrast, ≥ 44px targets, live-region announcements.
- **Next.js structure:** route-private UI in `app/(protected)/applications/[id]/_components/`, shared primitives in `components/ui/`, domain in `lib/applications/`, thin Server Action in `app/actions/`, tokens via Tailwind v4 theme (no raw hex). Before Phase 6 re-read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{dynamic-routes,not-found,page}.md` (Next 16: `params` is a `Promise`).

Inputs: `change.md` (story + ACs), `research.md` (§10 decisions accepted by Natta on 2026-11-20), design section "02 · APPLICATIONS — FEATURE 1" in `supabase/docs/nextjoblog-mvp-screens.html`, `supabase/docs/nextjoblog-supabase-schema-en.md`.

## Current State Analysis

See `research.md` §1–§4. Key facts verified while planning:

- `ApplicationFormFields` already exposes an `optionalSection` slot; `FormField` wires id/aria through context; `Alert` has a `warning` tone; `DatePicker` has `onChange` but cannot clear.
- DB columns `closing_date`, `work_format`, `contract_type`, `discipline`, `tech_stack text[] not null default '{}'`, `salary_info` already exist with RLS. **No migration.**
- `FIELD_NAMES` (5 required) drives validation, form-data, form-view, repository select, idempotency compare and `ApplicationFormValues = Record<FieldName,string>`. This single coupling is what the plan splits (required vs optional) without touching required behaviour.
- `redirect(APPLICATIONS_PATH)` in `app/actions/applications.ts` changes to the new detail path (decision 2).
- No detail route, no `get(id)`; `ApplicationRow` holds an inline, safe-URL-checked posting link that the hero must reuse.

## Desired End State

- `/applications/new` shows the Required card then a "Job details · optional" card (two-column grid): Closing date (calendar, clearable, live warning), Salary (text), Work arrangement / Contract type / Track (single-select pill groups with Clear), Required technologies (tag input).
- Save with any optional values persists them (empty → `null`, no tags → `{}`) and redirects to `/applications/{id}`.
- `/applications/{id}` shows hero + Job details `<dl>`; unset values render "—" (announced as "Not provided"); technologies as chips; unknown/foreign/malformed id → not-found page.
- Retry/idempotency still correct with optional fields; required-only submissions behave exactly as before.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run test:run` (coverage gates) pass locally; CI (Playwright, `supabase test db`) green with run ID recorded in Progress.

### Key Discoveries

- Unknown enum values from a tampered POST are **rejected with a field error** (server authoritative), not silently dropped (resolves research §8 wording).
- Idempotent retry (`hasSameContent`) must compare optional columns or a retry with different optional values is mis-classified as `already_exists`.
- React 19 resets uncontrolled inputs after an action: `ChoiceGroup`, `TagInput` and the date pair are seeded from `values` and remounted by the existing `key={submission}`.
- Native radios post nothing when none is selected, which `readString` already maps to `""`; hidden `tech_stack` inputs work with `formData.getAll`.

## What We're NOT Doing

- Edit screen, update port/action, "Changes saved" toast (next change; it reuses everything built here).
- Detail-page notes, status change, delete, documents, history (other stories); hero Edit/Delete buttons.
- Closing-date-vs-today warning, auto-fill from posting link, "Website Where Found".
- Cleanup migration for legacy columns (`source_website`, `fit_*`, `missing_skills`); enum migration (Fixed-term is a label for `contract`).
- Searching/filtering the list by the new fields.

## Prerequisites

None. No new dependencies (`react-day-picker` is already installed). Playwright/pgTAP run in CI only on this machine (precedent: Story 1.1).

## Implementation Approach

Bottom-up, TDD, each phase independently verifiable and committed:

1. Pure domain modules and tables.
2. Validation / form-data / form-view (extend, required behaviour unchanged).
3. Service, repository, port, Server Action redirect.
4. `components/ui/` additions.
5. Form wiring (JobDetailsSection, warning hook).
6. Detail page.
7. E2E, SQL, docs, evidence.

### Decisions taken during planning (beyond research)

| Decision | Choice |
| --- | --- |
| Type split | Keep `FIELD_NAMES`/`RequiredFormValues` untouched. Add `OPTIONAL_FIELD_NAMES`, `JobDetailsValues`. `ApplicationFormValues = RequiredFormValues & JobDetailsValues`; `FieldName = RequiredFieldName \| OptionalFieldName`; `ALL_FIELD_NAMES` (required then optional) is the form order used by errors/summary/focus. |
| Option tables | One `CHOICE_FIELDS: readonly ChoiceFieldConfig[]` (`name`, `label`, `options: {value,label}[]`) in `job-details.ts`. Form renders it with `map`; detail view and validator look labels/allow-lists up from it. "Fixed-term" ↔ value `contract`. |
| Enum value types | `WorkFormat`, `ContractType`, `Discipline` unions derived from the tables (`as const`), matching DB enums; a unit test asserts each table value is in the DB enum, parsing the `create type … as enum (…)` lines from `supabase/migrations/20260902082509_create_enums.sql` at test time (no hand-copied list) to catch drift. |
| Pill control | `ChoiceGroup` = `<fieldset>` + `<legend>` + native radio inputs styled as pills (free arrow-key navigation and form posting) + a visible "Clear" button when a value is set. No toggle-on-click trick. |
| Tag input | `TagInput` posts one hidden `tech_stack` input per tag; the visible text input has no `name`. Enter or comma adds, Backspace on empty removes last, blur adds pending text (so clicking Save never loses it), Enter never submits. Add policy is injected (`addTag`) so the component stays domain-free. |
| Warning UI | `FormField` gains optional `warning` (renders `role="status"`, warning icon, joined into `aria-describedby`, never sets `aria-invalid`). No separate notice component; DRY with help/error. |
| Date pair state | `ApplicationFormFields` becomes a client component holding `appliedDate`/`closingDate` through `useClosingDateWarning` (pure `isClosingBeforeApplied` inside). `DatePicker.onChange` feeds it; `DatePicker` gets `clearable` (Clear button in popover) and calls `onChange("")`. |
| Persistence shape | `NewApplicationRecord` extends with nullable `closing_date`, `work_format`, `contract_type`, `discipline`, `salary_info` and `tech_stack: string[]`. `emptyToNull` in one place. |
| Detail read | `ApplicationDetailReader.get(id)`; id checked with shared `isUuid` before any query; not-found for missing/malformed/foreign id (RLS) identically (no existence leak). |
| Detail rendering | `buildJobDetailRows(detail)` pure → `{key,label,kind,value}[]`; `JobDetailsCard` maps rows to `DefinitionRow`. Hero chips and the list row share a new `PostingLink` (keeps the `isSafeHttpUrl` re-check in one place). |
| Redirect | `redirect(applicationDetailPath(id))`; `applicationDetailPath` in `paths.ts`. Existing action and e2e assertions on the old redirect are updated, not deleted. |
| Limits | `MAX_TAG_COUNT = 20`, `MAX_TAG_LENGTH = 40` (research §10.5); salary reuses `MAX_TEXT_LENGTH`. |

## Critical Implementation Details

- **Server authoritative:** the action still re-validates with the same pure module; `buildRecord` copies each column explicitly (no spread of `FormData`); unknown enum values are errors; tags are re-normalized and de-duplicated server-side.
- **Closing-date warning is not validation:** `validateApplicationInput` never returns an error for closing < applied; only `isClosingBeforeApplied` (shared by UI and any future screen) computes it. Compare ISO strings only after `isValidIsoDate` on both.
- **Normalization:** `normalizeText` (trim + NFC) for salary and tags; tag de-dupe is case-insensitive, first spelling kept; empty after normalization is dropped, not an error.
- **Idempotency:** `CONTENT_COLUMNS` = required + optional column names; `hasSameContent` uses a `sameValue(a,b)` helper handling arrays element-wise and `null`.
- **Redirect:** still outside `try/catch`.
- **No raw SQL / `.rpc(` / `.or(`**: the existing static test keeps passing; `.eq("id", id)` only.
- **Focus on first invalid:** `ChoiceGroup` root and `TagInput` text input receive `fieldId(name)` so `useFocusFirstInvalid` works (`fieldset` gets `tabIndex={-1}`).
- **Time zone / dates:** plain ISO strings, no `Date` arithmetic.

---

## Phase 1: Pure domain modules and tables

### Overview

Everything that needs no I/O, fully table-tested, before any UI or persistence changes.

### Changes Required

| File | Intent |
| --- | --- |
| `lib/applications/types.ts` | Add `OPTIONAL_FIELD_NAMES = ["closing_date","salary_info","work_format","contract_type","discipline","tech_stack"]`, `ALL_FIELD_NAMES`, `RequiredFormValues` (current record), `JobDetailsValues` (`tech_stack: string[]`, others `string`), `ApplicationFormValues` intersection, `FieldName` union, `NullableJobDetails`, extend `NewApplicationRecord`; add `ApplicationDetail`. `ApplicationSummary` stays required-only. |
| `lib/applications/job-details.ts` (new) | `CHOICE_FIELDS` (work_format, contract_type, discipline) with `{value,label}` options per research §2/§3.6; `findChoiceLabel(field, value)`; `isChoiceValue(field, value)`; `emptyJobDetails()`. |
| `lib/applications/closing-date.ts` (new) | `isClosingBeforeApplied(applied, closing): boolean` (false when either empty/invalid, equal is not before). |
| `lib/applications/tech-tags.ts` (new) | `normalizeTag`, `addTag(tags, raw, limits = TAG_LIMITS): AddTagResult` (`{status:'added', tags}` or `{status:'rejected', reason: 'empty'\|'duplicate'\|'too_long'\|'too_many'}`), `removeTag(tags, tag)`, `normalizeTags(rawTags)` for the server. |
| `lib/applications/uuid.ts` (new) | Move `UUID_PATTERN` here + `isUuid`; `form-data.ts` imports it. |
| `lib/applications/limits.ts` | Add `MAX_TAG_COUNT`, `MAX_TAG_LENGTH`, `TAG_LIMITS` object. |
| `lib/applications/messages.ts` | Add `FIELD_LABELS` entries for optional fields; `APPLICATION_MESSAGES` (`invalidChoice(label)`, `tooManyTags(max)`, `tagTooLong(max)`), `APPLICATION_PAGE_MESSAGES` (`jobDetailsSection: "Job details"`, `optionalHint: "optional"`, `closingBeforeApplied` warning exact text from story, `salaryPlaceholder`, `techPlaceholder`, `removeTagLabel(tag)`, `clearChoiceLabel(label)`, `tagAddedAnnouncement`, `tagRemovedAnnouncement`, `notProvided`, `detailTitle`, `postingLinkLabel…`). All strings once. |
| `lib/applications/paths.ts` | `applicationDetailPath(id)`. |

### Success Criteria

#### Automated Verification

- New unit tests: `closing-date` (before / equal / after / either empty / invalid), `tech-tags` (trim, NFC, case-insensitive dedupe keeps first spelling, empty, too long, too many, remove, normalizeTags), `job-details` (labels, guards, **table values ⊆ DB enum values parsed from the migration file**), `uuid`, `paths`
- `npm run test:run`, `npx tsc --noEmit`, `npm run lint` pass (existing tests updated only for the widened value type via a `buildFormValues` test helper)

#### Manual Verification

- None (no UI).

---

## Phase 2: Validation, form-data, form-view

### Overview

Extend the pure pipeline so optional fields are parsed, validated, normalized and ordered; required behaviour is unchanged.

### Changes Required

#### 1. Validation

**File**: `lib/applications/validation.ts`

**Intent**: Add `OPTIONAL_FIELDS` rule table beside `REQUIRED_FIELDS` and a `validateOptionalField` that skips empty values (optional), then: control characters, `maxLength`, `check` (`closing_date` → `isValidIsoDate`; choice fields → `isChoiceValue`; `salary_info` → length). `tech_stack` validated by `validateTechStack(tags)` (count, per-tag length, control chars). `validateApplicationInput` merges both over `ALL_FIELD_NAMES`. `normalizeApplicationValues` normalizes text and `normalizeTags(tech_stack)`.

**Contract**: closing before applied is **not** an error; required-field errors and messages are byte-identical to today.

#### 2. Form data and view

**Files**: `lib/applications/form-data.ts`, `lib/applications/form-view.ts`

**Intent**: `readApplicationFormData` reads optional strings with `readString` and `tech_stack` with `formData.getAll(...).filter(isString)`. `initialFormValues(today)` includes `emptyJobDetails()`. `firstInvalidField` / `orderedErrors` iterate `ALL_FIELD_NAMES`.

### Success Criteria

#### Automated Verification

- `validation`, `form-data` and `form-view` tests pass: each optional rule valid/empty/invalid, enum tamper rejected, tag count/length, closing < applied produces **no** error, required tests unchanged and green; `getAll` tags, non-string entries ignored, missing optionals → empty, malformed client id still null; `ALL_FIELD_NAMES` order and `initialFormValues` shape
- `lib/applications/**` coverage ≥ 90%

---

## Phase 3: Service, repository, port, Server Action

### Overview

Persist optional columns, keep idempotency correct, add the detail read, redirect to the detail page.

### Changes Required

#### 1. Service

**File**: `lib/applications/log-application.ts`

**Intent**: `buildRecord` maps each column explicitly, converting empty strings to `null` through one `emptyToNull` helper (extracted to `lib/applications/text.ts` if reused) and passing `tech_stack` as `string[]`. Flow (validate → normalize → insert → one fresh-id retry) is unchanged.

#### 2. Ports and repository

**Files**: `lib/applications/ports.ts`, `lib/applications/repository.ts`

**Intent**: Add `ApplicationDetailReader { get(id): Promise<ApplicationDetail | null> }`. `toInsertRow` adds the six columns to the explicit allow-list. a new `IDEMPOTENCY_COLUMNS` (required + optional) feeds `classifyExistingRow`, while `CONTENT_COLUMNS` and `LIST_COLUMNS` stay on `FIELD_NAMES` so the list query is unchanged; `StoredContent` is widened to a typed row (`tech_stack: string[]`, nullable optionals); `hasSameContent` compares through `sameValue` (arrays element-wise, `null`-safe). `createApplicationDetailReader(client)` selects `id, <required>, <optional>, status` with `.eq("id", id).maybeSingle()`; error → `ApplicationRepositoryError(code)`; no row → `null`. Column lists are built from the name tables, not retyped.

#### 3. Server Action

**File**: `app/actions/applications.ts`

**Intent**: `redirect(applicationDetailPath(result.id))`. Nothing else changes (thin adapter).

### Success Criteria

#### Automated Verification

- Service tests: optional values persisted/normalized, empty → `null` and `[]`, enum tamper → `invalid`, required-only input produces identical record to before, retry-with-fresh-id path still works
- Repository tests: insert row has exactly the allow-listed keys (spoofed `status`/`user_id` ignored), **retry with different optional values → `id_conflict`**, same optional values → `already_exists`, `get` found / not found / error code only, list `select` string still contains only the five required columns plus `id` and `status`
- Action tests: redirect target is `/applications/{id}`; invalid / error states unchanged
- Static no-raw-SQL test passes; coverage ≥ 90% on `lib/applications/**`; tsc, lint pass

---

## Phase 4: `components/ui/` additions

### Overview

Generic, presentation-only primitives with no application knowledge.

### Changes Required

| File | Intent |
| --- | --- |
| `components/ui/Chip.tsx` (new) | Read-only chip (`span`); optional `onRemove` + `removeLabel` renders a ✕ `button` with `aria-label` (used by `TagInput` and the detail page). Token colours. |
| `components/ui/ChoiceGroup.tsx` (new) | Props: `legend`, `options`, `defaultValue`, `clearLabel`; reads `name`/`id` from `useFormFieldControl`. `fieldset`+`legend`, native radios styled as pills (checked state also shows a check icon, not colour alone), Clear button shown only when a value is set. Because it is a group, `FormField`'s `label htmlFor` points at the fieldset id; see note below. |
| `components/ui/TagInput.tsx` (new) | Props: `defaultValue`, `addTag` (injected policy), `placeholder`, `removeLabel(tag)`, `announce messages`, `rejectionMessages`. Behaviour as in the decisions table. Chips in a `<ul>`, polite live region for add/remove/rejection. |
| `components/ui/FormField.tsx` | Add `warning?: string` (see decisions). Add `as="group"` variant (renders `<div role="group" aria-labelledby>` instead of `<label htmlFor>`) so `ChoiceGroup` is not mislabelled. |
| `components/ui/DatePicker.tsx` | Add `clearable?: boolean`; popover shows a Clear button (label from `UI_MESSAGES.datePicker.clear`) that sets `""`, calls `onChange("")`, closes, returns focus to trigger. `handleSelect(undefined)` still ignored. |
| `components/ui/messages.ts` | Add `clear`. (`DefinitionList` is route-local to the detail page and moves to Phase 6; its empty-value strings come from `APPLICATION_PAGE_MESSAGES`.) |
| `components/ui/icons.tsx` | No new icon needed (`alert`, `check`, `close` exist). |

Note on labelling: `FormField` currently always renders `<label htmlFor>`; for groups, the legend is the label, so the `group` variant avoids a label pointing at a non-labelable element.

### Success Criteria

#### Automated Verification

- RTL + user-event tests (`__tests__/ui/`): `Chip` remove button label; `ChoiceGroup` click selects, arrow keys move, Clear appears/clears, posts name/value through a real `<form>` (`FormData`), nothing posted when empty, `defaultValue` honoured; `TagInput` Enter adds, comma adds, duplicate/empty/limit rejected with message, ✕ removes, Backspace on empty removes last, blur adds pending text, Enter does not submit the surrounding form, hidden inputs post each tag, live-region text; `FormField` warning role/`aria-describedby`/no `aria-invalid`, group variant; `DatePicker` clear posts `""` and fires `onChange("")`; the route-local `DefinitionRow` (empty → dash + "Not provided") is tested in Phase 6 (step 4.2 keeps its title; only the `DefinitionList` part moves)
- Existing `display-components` / `form-controls` tests still pass
- tsc, lint, coverage pass

#### Manual Verification

- Visual check of pills, chips and warning against the design at 1280px and 375px (rendered in the form in Phase 5; tracked as step 4.4).

---

## Phase 5: Form wiring

### Overview

Render the Job details card in the Add form and make the closing-date warning live.

### Changes Required

#### 1. Warning state hook

**File**: `app/(protected)/applications/new/_components/useClosingDateWarning.ts`

**Intent**: `useClosingDateWarning(initialApplied, initialClosing)` → `{ setAppliedDate, setClosingDate, showWarning }`, deriving `showWarning` from `isClosingBeforeApplied` (no effect/state duplication).

#### 2. Optional section

**Files**: `app/(protected)/applications/new/_components/JobDetailsSection.tsx` (new), `ApplicationFormFields.tsx`

**Intent**: `JobDetailsSection` renders `SectionLabel` (hint "optional") and a `Card` grid: Closing date (`DatePicker clearable`, `FormField warning`), Salary (`TextInput` with placeholder), then `CHOICE_FIELDS.map` → `FormField as="group"` + `ChoiceGroup`, then Required technologies (`TagInput` with `addTag`). `ApplicationFormFields` is marked `"use client"`, owns the date pair via the hook, passes the applied-date `onChange`, and fills `optionalSection`. Required fields markup unchanged.

#### 3. Form view plumbing

**Files**: `ApplicationForm.tsx`, `new/page.tsx`

**Intent**: No new props needed (values already carry optional fields via `initialFormValues`). Verify summary/focus for optional field errors.

### Success Criteria

#### Automated Verification

- Component tests: warning appears for applied 25 Aug + closing 20 Aug, disappears when closing ≥ applied and when cleared, appears when **applied** date is moved after closing, never blocks submit (submit still called); values re-seeded after a failed save (tags, pills, closing date retained); choice/tag error messages render and focus the right control; existing `ApplicationForm` tests pass unchanged except explicit optional-field additions
- Payload test: submitting with all optional fields posts the expected `FormData` (`tech_stack` repeated)
- tsc, lint, coverage pass

#### Manual Verification

- Form matches design section 02 (desktop + mobile), keyboard-only pass (pills with arrows, Clear, tag Enter/Backspace/Tab to ✕), screen-reader spot check of warning and remove buttons

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: Detail page

### Overview

Read-only `/applications/{id}` with hero and Job details card.

### Changes Required

#### 1. Pure view model

**File**: `lib/applications/detail-view.ts`

**Intent**: `JOB_DETAIL_ROWS` table (`closing_date` → formatted date, `work_format`/`contract_type`/`discipline` → label lookup, `tech_stack` → tags, `salary_info` → text) and `buildJobDetailRows(detail)` returning `{ key, label, kind: "text" | "tags", value }` (empty string/`null`/`[]` → `null` value). Also `heroChips(detail)` (work arrangement label if set, applied date).

#### 2. Page and components

**Files**: `app/(protected)/applications/[id]/page.tsx`, `_components/ApplicationHero.tsx`, `[id]/_components/DefinitionList.tsx` (`DefinitionList`, `DefinitionRow({term, children})`; empty/null children render `<span aria-hidden>—</span><span class="sr-only">Not provided</span>` using `APPLICATION_PAGE_MESSAGES`; promote to `components/ui/` when a second page needs it), `_components/JobDetailsCard.tsx`, `app/(protected)/applications/_components/PostingLink.tsx` (extracted from `ApplicationRow`, which now uses it; shared by the list row and the hero so the `isSafeHttpUrl` href re-check lives in one place); `ApplicationRow.tsx` also turns the title into a `next/link` `Link` to `applicationDetailPath(id)` (visible focus style, ≥ 44px target) so the detail page stays reachable from the list

**Intent**: Page: `const { id } = await params;` `requireSession()` (guard test requires it); handle `verification_failed`; `isUuid` else `notFound()`; load via `createApplicationDetailReader(client).get(id)`, `null` → `notFound()`; reader errors → `Alert` with load-failed message (logged via `logApplicationEvent`, code only), mirroring the list page. `PageHeader` with `backHref={APPLICATIONS_PATH}`; `h1` page title, `SectionLabel` (`h2`) "Job details", `DefinitionList` rows from `buildJobDetailRows`, tags rendered with `Chip` in a `<ul>`. Posting link through `PostingLink` (safe-URL re-check). `metadata` title "Application — NextJobLog".

#### 3. Events and messages

**Files**: `lib/applications/log.ts`, `messages.ts`

**Intent**: Add `detailFailed` event and `detailLoadFailed` message.

### Success Criteria

#### Automated Verification

- `detail-view` unit tests (labels, date format, empty → null, tags, fixed-term label for `contract`); `DefinitionRow` empty → dash + "Not provided"
- Page/component tests: all values shown; unset rows show dash + "Not provided"; chips rendered; unsafe `posting_url` renders no link; `notFound` for malformed id and for `null`; load error shows alert; protected-pages guard test passes with the new page; `ApplicationRow` tests pass after `PostingLink` extraction and a new test asserts the title links to `/applications/{id}`
- tsc, lint, coverage pass

#### Manual Verification

- Detail page matches design `detail-main` (hero + Job details) at desktop and mobile; not-found screen appears for a random UUID and for another user's id

---

## Phase 7: SQL, E2E, a11y, docs and evidence

### Changes Required

#### 1. SQL

**File**: `supabase/tests/database/applications.test.sql`

**Intent**: Round-trip of the six optional columns, `tech_stack` defaults to `{}`, RLS: another user cannot select or update these columns. No migration, so no `supabase-test/` migration copy.

#### 2. E2E

**Files**: `e2e/applications.spec.ts`, `e2e/helpers/applications.ts`

**Intent**: Fill optional fields → Save → URL is `/applications/{id}` and values (incl. tag chips) visible; closing-date warning appears/disappears and Save still works with it showing; unset fields show "—"; other user's detail URL is not-found; axe scans on form and detail page. Update existing assertions that expect the post-save redirect to the list (keep the intent: the row is reachable from the list), and add a step that opens the detail page by clicking the row title in the list.

#### 3. Docs

**File**: `docs/applications.md`

**Intent**: Replace the "Story 1.2: pass optionalSection…" note with how optional fields work (tables to edit to add a field), the detail route, and the Fixed-term ↔ `contract` mapping. Update the Layout table.

#### 4. Change bookkeeping

**File**: `context/changes/add-job-details/change.md`

**Intent**: Status moves `planned` → `implementing` → `done` as phases complete; record CI run ID and coverage numbers in Progress.

### Success Criteria

#### Automated Verification

- `npm run lint`, `npx tsc --noEmit`, `npm run test:run` with coverage (global ≥ 80%, `lib/applications/**` ≥ 90%)
- CI `supabase test db` green
- CI Playwright incl. axe green (record run ID)

#### Manual Verification

- Walk through all ACs from `change.md` on desktop and mobile; keyboard-only and screen-reader pass of form and detail page

---

## Testing Strategy

### Unit Tests

Pure and table-driven: `closing-date`, `tech-tags`, `job-details`, `uuid`, `detail-view`, extended `validation`, `form-data`, `form-view`, `log-application`, `repository` (fake Supabase client), action.

### Integration / Component Tests

RTL + user-event for `Chip`, `ChoiceGroup`, `TagInput`, `FormField` (warning, group), `DatePicker` clear, `DefinitionList` (route-local, Phase 6), `JobDetailsSection`/`ApplicationFormFields` (the two edge-case ACs verbatim), `ApplicationForm` (payload, retained input), detail page + not-found.

### SQL and E2E

pgTAP additions and Playwright flows in Phase 7 (CI only on this machine).

### Acceptance-criteria traceability

| AC | Covered by |
| --- | --- |
| Optional fields saved and shown on detail page | Phases 3, 6; e2e |
| Predefined options for work arrangement / contract / track | `ChoiceGroup` + `CHOICE_FIELDS` tests; validation enum tamper test |
| Technologies stored as separate removable tags | `TagInput` tests; `getAll` form-data test; repository array write |
| Closing before applied shows warning, still saves | `isClosingBeforeApplied`, `useClosingDateWarning`, form component test, e2e |
| Warning disappears when fixed or cleared | Same + `DatePicker` clear |

### Manual Testing Steps

1. Add an application with every optional field; confirm redirect and detail values.
2. Add with none; confirm "—" rows and no errors.
3. Applied 25 Aug, closing 20 Aug: warning shows, Save works; change closing to 25 Aug or clear it: warning vanishes.
4. Keyboard-only through pills and tags; Enter in the tag box does not submit.
5. Break the network on Save: input (tags, pills, dates) retained, Retry works without duplicates.

## Performance Considerations

One extra single-row select on the detail page; list query unchanged. Tag count (≤ 20) and lengths bound payload size.

## Migration Notes

No schema change and no data migration; existing rows have `null`/`{}` optional values and render "—". Rollback is a code revert.

## Addenda

- Legacy-column cleanup migration and Edit screen are tracked as separate changes (research §10).
- If the `Alert`-based warning proves too heavy visually, `FormField.warning` styling can change without touching callers.

## References

- `context/changes/add-job-details/change.md`, `research.md`
- `supabase/docs/nextjoblog-mvp-screens.html` (section 02, `form-body` template, `detail-main` template)
- `supabase/docs/nextjoblog-supabase-schema-en.md`
- `docs/applications.md`
- Next 16 docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{dynamic-routes,not-found,page}.md`

## Progress

### Phase 1: Pure domain modules and tables

#### Automated
- [x] 1.1 New unit tests pass (`closing-date`, `tech-tags`, `job-details`, `uuid`, `paths`) — ca91350
- [x] 1.2 Typecheck, lint and full suite pass — ca91350

### Phase 2: Validation, form-data, form-view

#### Automated
- [x] 2.1 Validation, form-data, form-view tests pass (required behaviour unchanged)
- [x] 2.2 `lib/applications/**` coverage ≥ 90%

### Phase 3: Service, repository, port, Server Action

#### Automated
- [ ] 3.1 Service tests pass (optional values, empty → null)
- [ ] 3.2 Repository tests pass (allow-list, idempotency with optional fields, `get`)
- [ ] 3.3 Action redirect test passes
- [ ] 3.4 Static no-SQL test, coverage, typecheck, lint pass

### Phase 4: `components/ui/` additions

#### Automated
- [ ] 4.1 `Chip`, `ChoiceGroup`, `TagInput` tests pass
- [ ] 4.2 `FormField` warning/group, `DatePicker` clear, `DefinitionList` tests pass
- [ ] 4.3 Existing UI tests, typecheck, lint, coverage pass

#### Manual
- [ ] 4.4 Pills, chips and warning visually match the design (1280px and 375px)

### Phase 5: Form wiring

#### Automated
- [ ] 5.1 Warning appear/disappear/clear/never-blocks tests pass
- [ ] 5.2 Retained-input and payload tests pass; existing form tests pass
- [ ] 5.3 Typecheck, lint, coverage pass

#### Manual
- [ ] 5.4 Form matches design (desktop + mobile)
- [ ] 5.5 Keyboard-only and screen-reader spot check

### Phase 6: Detail page

#### Automated
- [ ] 6.1 `detail-view` unit tests pass
- [ ] 6.2 Detail page, not-found, unsafe-URL, load-error tests pass; guard test passes
- [ ] 6.3 `PostingLink` extraction keeps `ApplicationRow` tests green; typecheck, lint, coverage pass

#### Manual
- [ ] 6.4 Detail page matches design; not-found for random and foreign id

### Phase 7: SQL, E2E, a11y, docs and evidence

#### Automated
- [ ] 7.1 `supabase test db` passes (CI)
- [ ] 7.2 Playwright + axe green (CI, record run ID)
- [ ] 7.3 Lint, typecheck, coverage gates (global ≥ 80%, `lib/applications/**` ≥ 90%)

#### Manual
- [ ] 7.4 All story ACs walked through on desktop and mobile
- [ ] 7.5 `docs/applications.md` updated; `change.md` status updated
