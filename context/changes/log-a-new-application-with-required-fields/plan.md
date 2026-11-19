# Log a New Application with Required Fields (Story 1.1) Implementation Plan

## Overview

Let a signed-in Job Seeker log a new application from `/applications/new` with five required fields (title, company, applied date, location, job posting link). The application is saved with status `applied`, a first `status_history` row is written by a DB trigger, and the user lands on `/applications` where the new row is visible immediately. The change also delivers the design's main navigation (side nav on desktop, header + drawer on mobile), the design-token swap, and a small light-theme `components/ui/` kit that Story 1.2, Edit and the dashboard reuse.

Engineering rules from the invocation, applied to every phase:

- **No hard-coded values, DRY:** every number, path, label, message and status mapping lives once in a named constant or data table (`lib/applications/*`, `lib/navigation/*`). Components receive them, they do not re-declare them.
- **SOLID:** pure validation/date/status modules; `logApplication(deps, input)` depends on a one-method repository interface; the Server Action is the only place that builds real dependencies; UI is presentational components + one container hook. Extension by data/slots (`NAV_ITEMS`, `REQUIRED_FIELDS`, form slot), not by editing branches.
- **Clean code:** self-documenting names, no magic numbers, no clever hacks; small composable units.
- **Testability:** injected clock and repository, no hidden globals. **Coverage ≥ 80% global (already a CI gate in `vitest.config.mts`) and ≥ 90% for `lib/applications/**`** (new threshold, mirrors `lib/auth/**`).
- **a11y:** semantic HTML, `aria-invalid`/`aria-describedby`, focus to the first invalid field, keyboard-operable date picker and drawer, token contrast kept.
- **Next.js structure:** colocate by route (`app/(protected)/applications/_components`), share by domain (`lib/`, `components/`), tokens through Tailwind v4 `@theme`. Before writing code in a phase, read the relevant guide in `node_modules/next/dist/docs/` (this Next 16.3.4 differs from training data; `AGENTS.md`).

## Current State Analysis

See `research.md` (§3 codebase, §4 design). Key facts:

- No applications code exists; only tables + RLS (`supabase/migrations/20260902082510_create_tables.sql`). `status` still defaults to `'interested'`; no trigger writes `status_history`.
- Protected shell is `app/(protected)/layout.tsx` + `AppTopBar` + `AccountControls`; no nav links. `AccountSheet` overlay is `md:hidden`.
- Every `app/(protected)/**/page.tsx` must call `requireSession()` (guard test). Pattern for DI use case + thin action: `lib/auth/request-password-reset.ts` + `app/actions/password-reset.ts`. Field a11y reference: `components/auth/PasswordInput.tsx`.
- Auth UI is dark-themed; its classes must not be reused for the light app screens.
- Design tokens differ from `app/globals.css` (research §4b). Vitest gates: 80% global, 90% `lib/auth/**`.
- Dev machine cannot run Playwright (macOS 13): unit/component tests and lint/typecheck run locally; Playwright and pgTAP run in CI only (precedent: Story 0.6).

## Desired End State

- `/applications/new` shows the five-field form (Required section), applied date pre-filled with today in the user's time zone via a calendar picker (icon, no typing, future dates allowed).
- Valid Save → row inserted (`user_id` from session, `status='applied'`, client UUID as `id`) → redirect to `/applications` showing it with an "Applied" badge. Retry after a lost response does not duplicate.
- Empty/invalid fields show per-field messages (and an error summary), focus moves to the first invalid field, the URL message includes `https://…`. Save failure keeps all input and shows an alert with Retry.
- `/applications` lists the user's applications newest-first, with an empty state when none.
- Desktop side nav and mobile header/drawer per design, with Dashboard and Applications only; logout, session-expiry and account flows still work.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run test:run` (coverage gates) pass locally; CI (unit, `supabase test db`, Playwright) is green with the run ID recorded in Progress.

### Key Discoveries

- React 19 resets uncontrolled forms after a `<form action>`; inputs must be re-rendered from returned `values` to satisfy the retain-input AC (research §6.1).
- "Today" must use `profiles.timezone`, not server UTC (research §6.2); it seeds the 7- and 14-day reminders.
- `posting_url` must be allow-listed to http/https at validation **and** at render (XSS sink).
- Inserts must be built field-by-field, never from spread/`FormData` entries (mass-assignment).
- Migrations must be manually copied to `supabase-test/supabase/migrations/`.

## What We're NOT Doing

- Optional fields (Story 1.2), search/status filter and filtered-empty state (1.11), detail/edit/board screens, Calendar/Analytics/CV library nav entries.
- Refactoring `SignupAlerts` or other auth components onto `components/ui/` (only the token rename touches them).
- `source_website` / `fit_*` schema cleanup; recording **later** status changes in `status_history` (Feature 2).
- Editing the staged deletion of `supabase/docs/Nextjoblog-supabase-schema.md`; the new migration is the record.
- Recurrent reminders, i18n, typed date entry.

## Prerequisites

Approval to add two dependencies was **granted by the user on 2026-11-19**: `react-day-picker` (runtime, pinned exact version, installed in Phase 6) and `@axe-core/playwright` (dev, pinned exact version, installed in Phase 8). Neither is installed until its phase. Progress 6.1 still verifies React 19 / Tailwind v4 compatibility of `react-day-picker`; the approval covers adding it, not skipping that spike.

## Implementation Approach

Bottom-up, each phase independently verifiable and committed, TDD (write tests with each unit). Order follows research §9, with the riskiest slice (navigation shell) isolated:

1. Token swap (mechanical).
2. DB migration + SQL tests.
3. Navigation shell.
4. Pure `lib/applications` modules.
5. Service, repository, Server Action.
6. `components/ui/` kit incl. `DatePicker`.
7. Form and list pages.
8. E2E, a11y, docs, evidence.

### Decisions taken during planning (beyond research)

| Decision | Choice |
| --- | --- |
| Validation shape | Declarative `REQUIRED_FIELDS: readonly FieldRule[]` (`{name, label, validate}`); `validateApplicationInput` maps over it. Story 1.2 appends rules. |
| Result types | Discriminated unions: `LogApplicationResult = {status:'created', id} \| {status:'invalid', errors, values} \| {status:'error', values}`; Action maps `created` to `redirect`. |
| Repository port | `ApplicationRepository { insert(record): Promise<InsertOutcome>; list(): Promise<ApplicationSummary[]> }` split into `ApplicationWriter` / `ApplicationReader` (ISP). `InsertOutcome = 'inserted' \| 'already_exists' \| 'id_conflict'` (idempotent retry; conflict = same id, different content or not owned). |
| Idempotency | Hidden `client_id` UUID; on PK violation `23505` re-select by id (RLS-scoped); `already_exists` counts as success **only if** the stored title/company/applied_date/location/posting_url equal the submitted ones, otherwise the service retries once with a fresh server `crypto.randomUUID()` (guards Back-button resubmits with edited values). The `client_id` is generated by the server page and passed to the form as a prop (no client-render UUID, no hydration mismatch). Malformed/missing id → server `crypto.randomUUID()`. |
| Time zone | `getUserTimeZone(reader)` (in `lib/applications/time-zone.ts`, reader port implemented in `repository.ts`) reads `profiles.timezone`, fallback constant `DEFAULT_TIME_ZONE='Europe/Stockholm'`; `todayInTimeZone(now, tz)` pure. |
| Text rules | trim, NFC-normalise, reject C0 control chars and NUL, max 200 (title/company/location) and 2048 (URL); constants in `lib/applications/limits.ts`. |
| Date picker | `react-day-picker` exact pinned version (verify React 19 + Tailwind v4 at install), styled via `classNames` + tokens. Spike in Phase 6 step 1; fallback is a hand-built grid behind the same `DatePicker` props if incompatible. |
| Nav landmark | One shared `NavLinks` list (data from `NAV_ITEMS`) rendered in two containers: static `SideNav` (`hidden md:flex`) and a `NavDrawer` dialog mounted only while open, inside `md:hidden`. Exactly one `<nav aria-label="Main">` is visible per breakpoint; `display:none` subtrees are out of the a11y tree and tab order. `role="dialog"`/`aria-modal`/focus trap/scroll lock live only on the drawer. No JS viewport branching. |
| Fonts | Move font loading from `components/auth/fonts.ts` to `components/fonts.ts`, applied in the root layout; mono = Geist Mono (already loaded) instead of IBM Plex Mono. |
| `components/ui` scope | Only components this story uses (research §8.6). |
| Token utilities | Use design names verbatim in `@theme inline`; add `ink` alias for `text` colour to avoid `text-text`. |
| Coverage | Add `lib/applications/**` 90% threshold in `vitest.config.mts`. |

## Critical Implementation Details

- **Server authoritative:** the action calls `requireSession()` itself, reads `claims.sub`, re-validates with the same pure module the client uses, and ignores any posted `status`/`user_id`/`created_at`.
- **FormData parsing** in one pure helper `readApplicationFormData(formData)`: only `typeof === 'string'` values count, else `''`.
- **Redirect:** `redirect()` throws; call it outside `try/catch`, after the service returns `created`.
- **Errors:** repository maps any Supabase error to `error` and logs `{code}` only via a feature logger modelled on `lib/auth/log.ts`; never return `error.message`.
- **Focus management:** `useFocusFirstInvalid(errors, fieldOrder)` hook (effect keyed on a submission counter), reused by Edit later. Summary links and inputs share ids from `fieldId(name)`.
- **No double insert:** the action never inserts `status_history`; the trigger owns it (test asserts exactly one row).
- **Modal stacking:** drawer, account sheet and session-expiry dialog never coexist; extend the existing `suspended` signal in `ProtectedAppShell`.
- **Link rendering:** `ApplicationRow` re-checks `isSafeHttpUrl` before rendering any `href`; external links get `rel="noopener noreferrer" target="_blank"`.
- **No SQL strings / `.rpc(` / `.or(` in the feature**; enforced by a static test.

---

## Phase 1: Design token swap (mechanical)

### Overview

Make the design tokens the single source of truth before any feature code, in one reviewable commit.

### Changes Required

#### 1. Tokens and Tailwind theme

**Files**: `app/globals.css`

**Intent**: Replace/add tokens per research §4b table (`paper`, `success-tint` values; rename `*-fg` → `*-text`; add cobalt, link, danger, success, warning, app-bg, subtle, border, border-strong, text, text-2, text-3, on-dark*, neutral, star). Register in `@theme inline` so utilities exist. Keep `auth-*` tokens untouched.

**Contract**: Every design token has a CSS variable and a Tailwind colour; no component uses a raw hex.

#### 2. Rename call sites

**Files**: `app/signup/SignupAlerts.tsx`, `app/login/LoginAlert.tsx`, `app/(protected)/_components/{LogoutButton,PasswordUpdatedToast,AccountSheet}.tsx`

**Intent**: `-fg` → `-text` find/replace only. No markup change.

#### 3. Shared fonts

**Files**: `components/fonts.ts` (moved from `components/auth/fonts.ts`), `app/layout.tsx`, auth pages importing fonts

**Intent**: Fonts available to the protected shell; auth pages keep working. `--font-display`, `--font-body`, `--font-mono` variables. Add the weights the design uses: Archivo `[700, 800]` and Work Sans `[400, 500, 600]` (currently 700 and 400/600 only); `AuthPageShell` is the only importer today (`./fonts`).

### Success Criteria

#### Automated Verification

- Existing suite passes unchanged: `npm run test:run`
- `npx tsc --noEmit` and `npm run lint` pass
- `grep -rn "\-fg" app components` returns no token usages

#### Manual Verification

- `/login`, `/signup`, `/dashboard` look correct (no unstyled text, missing colours or changed auth font weights)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Database migration and SQL tests

### Overview

Default status `applied` and the history-on-insert trigger.

### Changes Required

#### 1. Migration

**Files**: `supabase/migrations/<timestamp>_application_defaults_and_history_trigger.sql`, copy in `supabase-test/supabase/migrations/`

**Intent**: `alter table public.applications alter column status set default 'applied';` and `create function public.record_initial_status() … security definer set search_path = ''` inserting `(application_id, user_id, status, changed_at) = (new.id, new.user_id, new.status, new.created_at)` into `public.status_history`; `after insert on public.applications for each row` trigger. No dynamic SQL. Style follows `20260903100000_create_profile_trigger.sql`.

#### 2. SQL tests

**File**: `supabase/tests/database/applications.test.sql` (beside `rate_limit_consume.test.sql`)

**Intent**: default status is `applied`; insert creates exactly one history row with same `user_id`, status and timestamp; insert with another user's `user_id` rejected by RLS; second user cannot read the history; duplicate PK insert fails without a second history row; literal injection string stored verbatim.

### Success Criteria

#### Automated Verification

- `supabase test db` passes (CI only on this machine)
- `diff -r supabase/migrations supabase-test/supabase/migrations` is empty

#### Manual Verification

- Migration reviewed against the security checklist (search_path pinned, qualified names, no dynamic SQL)

---

## Phase 3: Navigation shell

### Overview

Replace `AppTopBar` with side nav (≥ `md`) and header + drawer (< `md`) from one data source, keeping logout, account and session-expiry behaviour.

### Changes Required

#### 1. Data and pure logic

**Files**: `lib/navigation/nav-items.ts`, `lib/applications/paths.ts`

**Intent**: `NAV_ITEMS` (Dashboard, Applications: id, label, href, icon id); `isNavItemActive(pathname, href)` segment-boundary prefix match; path constants shared with the Add link.

#### 2. Icons

**File**: `components/ui/icons.tsx`

**Intent**: Small `aria-hidden` icon components with a `size` prop (home, list, plus, menu, close, file, calendar, chevrons, alert, info, check) ported from the design's `IC` map. One mapping `NAV_ICONS: Record<NavIconId, Component>` so `MainNav` has no branching.

#### 3. Components

**Files**: `components/navigation/MainNav.tsx`, `app/(protected)/_components/{SideNav,SiteHeader,NavDrawer,AccountRow,AddApplicationLink}.tsx`, `useNavDrawer.ts`, updated `ProtectedAppShell.tsx`, `AccountSheet.tsx`, `AccountControls.tsx`, `layout.tsx`; remove `AppTopBar.tsx`

**Intent**: `MainNav` is one `<nav aria-label="Main">` with `aria-current="page"`, rendered once inside `SideNav` and once inside `NavDrawer` (only one is visible at any width; no id may repeat between them). `useNavDrawer` handles open state, Esc, focus in/return, close on pathname change, body scroll lock, backdrop click, reusing `useDialogKeyboardNavigation`. `AccountSheet` gains a centred-dialog variant at `md+` (design). Layout becomes a flex row; main scrolls; content max width constant. The protected layout root sets `text-ink` and `color-scheme: light` so the `prefers-color-scheme: dark` override of `--foreground`/`--background` in `globals.css` never reaches the light app screens. Logo gains `size`/label props.

**Contract**: Header `Add` and side-nav `Add application` are real links to `NEW_APPLICATION_PATH`. `useLogout` stays mounted while sheet/dialog closes.

#### 4. Focus-trap hook

**File**: `app/(protected)/_components/useDialogKeyboardNavigation.ts`

**Intent**: Widen `firstFocusableRef`/`lastFocusableRef` from `RefObject<HTMLButtonElement | null>` to `RefObject<HTMLElement | null>` so the drawer can end on a nav link or the account row. `AccountSheet` callers stay valid; existing hook tests must still pass.

#### 5. Existing tests

**Files**: `__tests__/protected/{AccountControls,AccountMenu,layout}.test.tsx`, `e2e/logout.spec.ts`, `e2e/session-expiry.spec.ts`

**Intent**: Update selectors, do not delete assertions. Check selectors before refactoring.

### Success Criteria

#### Automated Verification

- New tests: `isNavItemActive` cases; `MainNav` landmark + `aria-current`, drawer mounted only when open with `role="dialog"`/`aria-modal`; hamburger `aria-expanded`, focus in/return, Esc, backdrop, route-change close, focus trap; account row opens dialog; modals never coexist
- Updated `AccountControls`, `AccountMenu` and `layout` tests pass with their original assertions kept
- `npm run test:run`, `npx tsc --noEmit`, `npm run lint` pass; protected-pages guard test passes
- CI is green for the updated `e2e/logout.spec.ts` and `e2e/session-expiry.spec.ts` (push the branch; Playwright can't run locally) before starting Phase 4

#### Manual Verification

- At 1280px and 375px: nav matches design, also with the OS in dark mode (text stays dark on light surfaces)
- Keyboard-only drawer walkthrough
- Logout and session-expiry still work

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Pure `lib/applications` modules

### Overview

All feature logic that needs no I/O, 90%+ covered.

### Changes Required

| File | Intent |
| --- | --- |
| `types.ts` | `ApplicationStatus`, `ApplicationFormValues`, `FieldName`, `FieldErrors`, `NewApplicationRecord` |
| `limits.ts` | `MAX_TEXT_LENGTH=200`, `MAX_URL_LENGTH=2048`, `DEFAULT_TIME_ZONE` |
| `messages.ts` | every user-facing string incl. `https://example.com/job` example, required/too-long/invalid messages as functions of label |
| `status.ts` | `STATUS_DISPLAY: Record<ApplicationStatus,{label,tone}>`, `INITIAL_APPLICATION_STATUS='applied'` |
| `dates.ts` | `todayInTimeZone(now, tz)`, `isValidIsoDate`, `formatDisplayDate(iso)` |
| `url.ts` | `isSafeHttpUrl(value)` (http/https only), used by validation and render |
| `time-zone.ts` | `ProfileTimeZoneReader { getTimeZone(): Promise<string \| null> }` port, pure `isValidTimeZone(tz)` (try `Intl.DateTimeFormat`, catch `RangeError`), `getUserTimeZone(reader)` falling back to `DEFAULT_TIME_ZONE` on a missing profile row, null, invalid zone, or reader error |
| `text.ts` | `normalizeText` (trim, NFC), `hasControlCharacters` |
| `validation.ts` | `REQUIRED_FIELDS` rules + `validateApplicationInput(values)` returning all errors in form order |
| `form-data.ts` | `readApplicationFormData(formData)` string-only extraction + `client_id` UUID check |

**Contract**: Every function pure; clock and time zone are parameters.

**Config**: `vitest.config.mts` gains a `"lib/applications/**"` threshold of 90 (lines, statements, functions, branches), mirroring `"lib/auth/**"`, in this phase so every later phase is gated.

### Success Criteria

#### Automated Verification

- Table-driven tests: each field empty/whitespace; `"linkedin job"`, `javascript:`, `data:`, `file:`, `ftp:`; max lengths at, below, above boundary; NUL/control chars; `2026-02-30`; time-zone midnight and DST boundaries; `getUserTimeZone` falls back for null, missing row, invalid zone (`"Not/AZone"`) and reader error; every status enum value has a display entry; injection payload table accepted verbatim where benign
- `npx vitest run __tests__/lib/applications --coverage.enabled=false` passes; `lib/applications/**` ≥ 90%

---

## Phase 5: Service, repository and Server Action

### Overview

Persist safely with injected dependencies.

### Changes Required

#### 1. Service

**File**: `lib/applications/log-application.ts`

**Intent**: `logApplication({ writer, newId }, userId, values)`: validate → build record field-by-field (`status = INITIAL_APPLICATION_STATUS`) → `writer.insert` → result union. Validation failure never calls the writer.

#### 2. Repository

**File**: `lib/applications/repository.ts`

**Intent**: Supabase implementations of `ApplicationWriter`/`ApplicationReader` taking a client; explicit 8-key insert object; `23505` + ownership re-select returning the stored five fields → `already_exists` when they match the submitted record, `id_conflict` when they differ or the row is not owned (service retries once with a fresh id); list ordered by `applied_date desc, created_at desc`; selects only list columns. Also a Supabase `ProfileTimeZoneReader` (selects `timezone` from `profiles` for the session user via the RLS-scoped client) used by the form page.

#### 3. Action

**File**: `app/actions/applications.ts`

**Intent**: `"use server"`; `requireSession()` (its redirect on an expired session is left to propagate; a `verification_failed` result returns `{status:'error', values}` so the user keeps their input); builds deps (`createServerSupabaseClient`, `crypto.randomUUID`); calls service; `created` → `redirect(APPLICATIONS_PATH)`; otherwise returns state with `values`. Logs `{code}` only.

### Success Criteria

#### Automated Verification

- Service with fake writer: success sets `applied` + trimmed values; invalid never calls writer; writer error → `{status:'error', values}`; `already_exists` → created; `id_conflict` → one retry with a fresh id, then created (second conflict → error)
- Repository: exactly 8 insert keys; spoofed `status`/`user_id`/`created_at` ignored; list ordering query
- Action (mock `next/headers`, `redirect`): FormData parsing, expired session redirects, `verification_failed` returns error state with values, redirect on success, state on failure
- Static test: no `.rpc(`, `.or(` or SQL template interpolation in feature files
- Coverage gates, `tsc`, `lint` pass

---

## Phase 6: `components/ui/` kit

### Overview

Reusable light-theme primitives, each with a test by role (no snapshots).

### Changes Required

| Component | Notes |
| --- | --- |
| `Button`, `ButtonLink` | variants/sizes as data maps; `pending` state disables |
| `Card`, `SectionLabel`, `PageHeader` | `PageHeader` has back (mobile), subtitle, actions slot |
| `FormField` | label, required marker, help, error; generates ids and passes `aria-*` to its control via render prop/context |
| `TextInput` | consumes `FormField` wiring |
| `DatePicker` | `react-day-picker` wrapper; hidden ISO input; trigger button `aria-haspopup="dialog"`; keyboard per research §4c; injected `today` |
| `Alert`, `ErrorSummary` | tone map; action slot; summary links to field ids |
| `StatusBadge`, `EmptyState` | from `STATUS_DISPLAY` and design |

**Intent**: Step 1 is a short spike installing `react-day-picker` (exact version, needs user approval to add dependency) and confirming React 19/Tailwind v4 styling; fall back per decision table if it fails.

### Success Criteria

#### Automated Verification

- `react-day-picker` approved by the user, pinned to an exact version, and confirmed compatible with React 19 and Tailwind v4 (or the fallback is chosen)
- Component tests: `FormField` ids/`aria-describedby` resolve; `Alert` `role="alert"` for danger; `DatePicker` default today, opens on click/Enter/Space, arrows move, Esc restores focus, typing does nothing, hidden input ISO, future date selectable, icon `aria-hidden`; `StatusBadge` per status
- Coverage gates, `tsc`, `lint` pass

#### Manual Verification

- Visual comparison with design (colour, spacing, focus ring, 44px touch targets)

---

## Phase 7: Form and list pages

### Overview

Compose the kit and logic into the two screens.

### Changes Required

#### 1. Add page

**Files**: `app/(protected)/applications/new/page.tsx`, `_components/{ApplicationForm,ApplicationFormFields,SaveFailedAlert}.tsx`, `useFocusFirstInvalid.ts`

**Intent**: Page calls `requireSession()`, handles `verification_failed` with `SessionCheckFailed`, resolves time zone and today's date, generates `client_id` (`crypto.randomUUID()` on the server), renders `PageHeader` + `ApplicationForm`. `ApplicationForm` (client) uses `useActionState`, client pre-validation with the shared validator, receives `client_id` as a prop and posts it in a hidden input, `noValidate`, renders inputs from `state.values` with a submission `key`. `ApplicationFormFields` is presentational with an `optionalSection` slot (Story 1.2/Edit).

#### 2. List page

**Files**: `app/(protected)/applications/page.tsx`, `_components/{ApplicationList,ApplicationRow}.tsx`

**Intent**: `requireSession()`, `listApplications` via reader, `EmptyState` with Add action when empty, rows with `StatusBadge`, display date, safe link rendering.

### Success Criteria

#### Automated Verification

- Form: today pre-filled; empty submit → 5 messages, focus on first invalid, `aria-invalid`/`aria-describedby`; bad URL message contains `https://`; failure keeps values and shows Retry; Retry resubmits; Save disabled while pending; Enter submits
- Pages: newest-first rows, empty state, `SessionCheckFailed`; guard test passes
- Coverage gates, `tsc`, `lint` pass

#### Manual Verification

- Keyboard-only and screen-reader pass (announcements, focus); copy matches design
- Mobile layout is usable

---

## Phase 8: E2E, a11y, docs and evidence

### Changes Required

- `e2e/applications.spec.ts`: login → add → appears with "Applied"; second user does not see it; injection-string title stored literally; failure/retry path if hookable; nav at 1280 and 375 widths (assert exactly one visible `nav` landmark at each); logout from side-nav row and avatar sheet.
- a11y: axe check on the form in error state (`@axe-core/playwright`, dev dependency needs approval).
- Docs: `docs/` note on the applications module layout and the migration; update `change.md`.

### Success Criteria

#### Automated Verification

- CI green (unit, `supabase test db`, Playwright); run ID recorded in Progress
- axe check on the form in error state passes
- `npm run lint`, `npx tsc --noEmit`, `npm run test:run` pass locally

#### Manual Verification

- Acceptance criteria in `change.md` walked through end to end

---

## Testing Strategy

### Unit Tests
Pure modules (validation, dates, url, status, form-data), service with fake writer, repository with fake client, nav logic. Table-driven where inputs vary.

### Integration / Component Tests
RTL + user-event by role/label; form, picker, drawer, list, pages. No brittle snapshots.

### SQL and E2E
pgTAP for default/trigger/RLS; Playwright for flows, RLS isolation, injection payload (CI only).

### Manual Testing Steps
1. Add an application with all five fields; see it in the list as Applied.
2. Submit empty; confirm five messages and focus on Title.
3. Enter `linkedin job` as link; confirm message with `https://` example.
4. Go offline, Save; confirm input kept with Retry; go online, Retry; confirm one row.
5. Change the date via picker with keyboard only; pick a future date.
6. Use nav at desktop and mobile widths; log out; trigger session-expiry notice.

## Performance Considerations
List selects only displayed columns and uses the existing `(user_id, applied_date)` index; `react-day-picker` is client-only and loaded in the form route. Nav links are rendered in the side nav and, only while open, in the drawer.

## Migration Notes
One new migration, copied to `supabase-test/`. Forward-only; existing rows keep their status. Rollback = new migration restoring default `'interested'` and dropping the trigger.

## References

- Story and ACs: `context/changes/log-a-new-application-with-required-fields/change.md`
- Research: `context/changes/log-a-new-application-with-required-fields/research.md`
- Design: `supabase/docs/nextjoblog-mvp-screens.html` lines 3093–3716 (section 02 Applications) and nav CSS 452–711
- Patterns: `lib/auth/request-password-reset.ts`, `app/actions/password-reset.ts`, `components/auth/PasswordInput.tsx`, `app/(protected)/dashboard/page.tsx`
- Prior plan format: `context/archive/2026-10-17-request-password-reset-email/plan.md`

## Progress

### Phase 1: Design token swap (mechanical)

#### Automated
- [x] 1.1 Existing suite passes unchanged
- [x] 1.2 Typecheck and lint pass
- [x] 1.3 No `-fg` token usages remain

#### Manual
- [x] 1.4 Login, signup, dashboard look correct

### Phase 2: Database migration and SQL tests

#### Automated
- [x] 2.1 `supabase test db` passes — `applications.test.sql` 9/9 pass locally (Docker was available); CI run still to confirm. Note: `rate_limit_consume.test.sql` tests 11–12 fail locally (pre-existing, untouched file; to investigate separately)
- [x] 2.2 `supabase/` and `supabase-test/` migrations identical (SQL files; the two READMEs differ by design)

#### Manual
- [x] 2.3 Migration security review (verified in file and live DB: `security definer`, `search_path=""`, execute revoked from `authenticated`, RLS test passes)

### Phase 3: Navigation shell

#### Automated
- [x] 3.1 Nav logic and component tests pass
- [x] 3.2 Updated account/layout tests pass (`AccountControls.test.tsx` renamed to `SideNav.test.tsx`: the inline desktop Log Out is replaced by the design's account row + dialog; same assertions kept)
- [x] 3.3 Guard test, typecheck, lint, coverage pass (61 files / 420 tests, 95% statements)
- [ ] 3.7 CI green for updated logout and session-expiry e2e

#### Manual
- [x] 3.4 Desktop and mobile match design
- [x] 3.5 Keyboard-only drawer walkthrough
- [x] 3.6 Logout and session-expiry still work

### Phase 4: Pure `lib/applications` modules

#### Automated
- [ ] 4.1 Table-driven unit tests pass
- [ ] 4.2 `lib/applications/**` coverage ≥ 90%

### Phase 5: Service, repository and Server Action

#### Automated
- [ ] 5.1 Service tests pass
- [ ] 5.2 Repository tests pass (8 keys, spoof ignored)
- [ ] 5.3 Action tests pass
- [ ] 5.4 Static no-SQL-string test passes
- [ ] 5.5 Coverage, typecheck, lint pass

### Phase 6: `components/ui/` kit

#### Automated
- [ ] 6.1 `react-day-picker` approved, pinned and compatible
- [ ] 6.2 Component tests pass
- [ ] 6.3 Coverage, typecheck, lint pass

#### Manual
- [ ] 6.4 Visual match with design

### Phase 7: Form and list pages

#### Automated
- [ ] 7.1 Form behaviour tests pass (AC coverage)
- [ ] 7.2 Page tests and guard test pass
- [ ] 7.3 Coverage, typecheck, lint pass

#### Manual
- [ ] 7.4 Keyboard and screen-reader pass
- [ ] 7.5 Mobile layout usable

### Phase 8: E2E, a11y, docs and evidence

#### Automated
- [ ] 8.1 CI green, run ID recorded
- [ ] 8.2 axe check passes
- [ ] 8.3 Local lint, typecheck, tests pass

#### Manual
- [ ] 8.4 All `change.md` acceptance criteria verified
