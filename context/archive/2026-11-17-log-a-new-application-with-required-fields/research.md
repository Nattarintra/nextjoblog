---
date: 2026-11-19T00:00:00+01:00
researcher: Natta
git_commit: 6ad7674e436eb6b32315582db694884595123e2f
branch: feature/log-a-new-application-with-required-fields
repository: nextjoblog
topic: "Log a new application with required fields (Story 1.1): /applications/new form, /applications list, main navigation shell, status-history trigger, design tokens"
tags: [research, applications, supabase, rls, nextjs-16, tailwind, a11y, navigation, forms, security, testing, react-day-picker]
status: complete
last_updated: 2026-11-19
last_updated_by: Natta
last_updated_note: "All open questions decided (side nav, status history, tokens, date picker, max lengths, idempotency, input safety)"
---

# Research — Story 1.1: Log a new application with required fields

Inputs: `change.md` (story + ACs), design section `02 · APPLICATIONS — FEATURE 1` of `supabase/docs/nextjoblog-mvp-screens.html` (lines 3093–3716), `supabase/docs/Nextjoblog-supabase-schema.md` + `supabase/migrations/*`, the current codebase, and the Next.js docs bundled in `node_modules/next/dist/docs/` (Next 16.3.4, React 19.2.8).

## 1. Summary

- **Nothing for applications exists yet.** No route, component, lib module, action or test mentions applications. Only the DB tables/RLS exist (migrations). Auth, session guard, shell and test infrastructure are mature and give clear patterns to copy.
- **The ACs need three pieces, not one:** the form (`/applications/new`), the Server Action that saves, and a minimal list (`/applications`) so "shows it in the application list immediately" is true. The richer list (search, status filter, empty states 1.11/1.12) is a later story; build only the base list + the "no applications yet" empty state.
- **The design is a light "paper" app theme; the existing UI is the dark auth theme.** Existing `components/auth/*` styles (`authInputClassName` etc.) are white-on-navy and must **not** be reused for these screens. Reuse the *patterns* (a11y wiring, `useActionState`, DI services, pure validators) and build a small light-theme `components/ui/` kit that Story 1.2 (optional fields), Edit and the list reuse.
- **Schema gap:** the migration still defaults `status` to `'interested'`; the decision (Natta, 16 Nov) is `'applied'`. Needs a new migration (and docs update). There is also no `status_history` row created on insert — see Open Questions.

## 2. Acceptance criteria → what must exist

| AC | Needs |
|---|---|
| Happy path: fill 5 fields, Save → created with status "Applied", appears in list | form, `logApplication` service, insert with `user_id` + `status='applied'`, redirect to `/applications`, list page reading rows |
| Applied date pre-filled with today, editable | pure `todayInTimeZone(now, tz)`; page passes the default; `DatePicker` (calendar popover + calendar icon, no typing, §4c) |
| Empty required field → message under each field, no save | pure `validateApplicationInput`; per-field error text; server re-validates (authoritative) |
| Non-URL link → "invalid", example `https://…`, no save | URL rule (http/https only) with the example in the message |
| Save fails → input retained, error + Retry | action returns `{status:"error", values}`; inputs re-rendered from `values` (see §6.1); alert with Retry submit button |
| a11y: message announced with field; focus to first invalid field | `aria-invalid`, `aria-describedby` → error id, focus first invalid input after failed validation, `role="alert"` summary |

## 3. Codebase findings

**Structure (already matches Next.js project-structure conventions):** route group `app/(protected)/` with `_components/` private folder; `app/actions/*.ts` server actions; `lib/<domain>/*` pure logic; `components/auth/*` shared UI; tests mirror paths under `__tests__/`; `@/*` alias; Vitest + RTL (jsdom); Playwright e2e under `e2e/`.

**Patterns to follow (verified in code):**
- **Guard:** every `app/(protected)/**/page.tsx` must call `requireSession()` — enforced by `__tests__/protected-pages-guard.test.ts`; handle `status === "verification_failed"` with `<SessionCheckFailed/>` like `app/(protected)/dashboard/page.tsx`. `docs/route-guard.md`: "query through the user-scoped Supabase client". `proxy.ts` redirects unauthenticated users for any non-public path, so new routes are protected by default.
- **Supabase client:** `createServerSupabaseClient()` (`lib/supabase/server.ts`, cookie-bound → RLS applies as the user). Not the stateless client (auth-only calls).
- **DI service shape:** `requestPasswordReset(deps, input)` in `lib/auth/request-password-reset.ts`, called by a thin action that wires real deps (`app/actions/password-reset.ts`). Reuse for `logApplication(deps, input)`.
- **Form shape:** `SignupForm` (container, `useActionState`, client pre-validation) → `SignupFields` (presentational) → field components. `SignupAlerts.tsx` duplicates SVG/markup per alert — a smell to avoid (§4).
- **Field a11y reference:** `components/auth/PasswordInput.tsx` already wires `aria-invalid`, `aria-describedby` → generated error id, `role="alert"`. Generalize into a reusable `FormField` instead of copying again.
- **Coverage:** `vitest.config.mts` already enforces **80%** global (lines/statements/functions/branches) and 90% for `lib/auth/**`. The requested ≥80% is already a CI gate; propose a 90% threshold for `lib/applications/**` to mirror auth. Coverage counts everything imported by tests, so every new component needs a test.
- **Tokens:** `app/globals.css` has `navy, sky, azure, mist, paper, warning/danger/success tint+fg`. The design uses more (§4). Existing `--danger-fg: #8a271f` differs from design `--danger-text: #a32a21`; `--paper` is `#fbfaf7` in code vs `#ffffff` in the design.
- **Fonts:** `Archivo` + `Work Sans` (auth) and Geist are loaded. Design body font is Work Sans, display Archivo, mono IBM Plex Mono (not loaded; Geist Mono is an acceptable substitute).

**Database** (migrations are the source of truth; `Nextjoblog-supabase-schema.md` is currently staged-for-deletion in git (`D`) but still on disk — confirm intent before editing it):
- `applications` required columns: `title, company, applied_date (date), location, posting_url` all `not null`; `user_id not null`; RLS `applications_owner` (`auth.uid() = user_id`, using + check). Insert must set `user_id` = session `sub` or RLS rejects it.
- `status` default is `'interested'` in `20260902082510_create_tables.sql:46` → new migration `alter table public.applications alter column status set default 'applied';`. `supabase/migrations/README.md` says migrations must be **manually copied** to `supabase-test/supabase/migrations/` (the e2e session-expiry project) — easy to forget. `supabase-test` is not git-ignored; verify it is tracked.
- Analytics views treat `applied` as "not yet responded", consistent with the new default.
- `profiles.timezone` (default `Europe/Stockholm`) exists (created by trigger at signup) → use it for "today" (§6.2).
- No length/format constraints on text columns.

### 3a. Status history on create (decided: yes)

- `status_history(id, application_id, user_id, status, changed_at)`; RLS `status_history_owner` requires `auth.uid() = user_id`; no insert path exists today, and no trigger exists besides `handle_new_user`.
- **Mechanism: DB trigger** `after insert on public.applications for each row` inserting `(new.id, new.user_id, new.status, new.created_at)`. Reasons: atomic with the insert (no half-saved application if a second client call fails), one place for every future insert path, no extra round trip, nothing for the Server Action to forget. Follow `20260903100000_create_profile_trigger.sql`: `security definer set search_path = ''`, fully qualified names.
- Use `new.status` (not a literal) so the history always matches the row's initial status. Using `created_at` keeps both timestamps identical (Feature 2 computes "+N days" from `changed_at`).
- **Scope boundary:** only the *insert* trigger belongs here. Recording later status changes (update trigger or app code) is Feature 2.
- Cascade is already correct (`on delete cascade` on `application_id`), so delete needs nothing.
- Tests: SQL test (insert application → exactly one history row, status `applied`, same `user_id`; second user cannot read it; rollback of the application insert leaves no history row); service/action tests need no change except asserting the action does **not** insert history itself (guards against double rows).
- Idempotency (§6.7): a retried insert with the same client UUID fails on the primary key *before* the trigger fires its second row — verify in the SQL test.
- Migration number: same new migration file as the default-status change, or a sibling; both copied to `supabase-test/` (§3).

## 4. Design analysis — what can be reused

| Component (proposed) | Design source | Used in |
|---|---|---|
| `PageHeader` (title, optional sub, mobile back button, actions slot) | `.topbar` (`list-topbar`, `scr-form`, `scr-form-edit`, `scr-detail`, `scr-not-found`) | list, add, edit, detail, not-found |
| `Button` (primary/secondary/danger/ghost; md/sm; link form) | `.btn*` | every screen |
| `Card` (+ padded) | `.card`, `.pad` | list, form, detail, empty |
| `SectionLabel` (optional / action slots) | `.section-label` ("Required", "Job details · optional") | form, detail |
| `FormField` (label, required `*`, help, error, warn; wires `id`/`aria-*`) + `TextInput` | `.field`, `.req`, `.help`, `.field-err` | Add, Edit, Story 1.2 |
| `Alert` (danger/warning/info/success; icon; action slot) | `.alert-*` — error summary, "Couldn't save + Retry", edit info banner | add, edit; replaces `SignupAlerts` duplication later |
| `ErrorSummary` (anchor links to invalid fields) | `scr-form-errors` `.err-summary` | Add, Edit |
| `StatusBadge` (status → label + tone) | `.badge st-*` | list, detail, board later |
| `EmptyState` (icon ring, title, text, action) | `.empty` | list now; filtered-empty and dashboard later |
| `ApplicationList` / `ApplicationRow` (+ list head) | `.app-row`, `.list-head`, `.ar-*` | list now; dashboard "recent" later |
| `ApplicationFormFields` (Required section + optional slot) | `form-body` template, shared by `scr-form` **and** `scr-form-edit` | Add now; Edit and 1.2 extend by composition |

**Key reuse decisions**
1. **One form body, two screens.** The design includes the same `form-body` in Add and Edit. `ApplicationFormFields` takes `values`, `errors` and a slot for the optional section → Story 1.2 adds fields and Edit passes saved values without touching required-field code (OCP).
2. **Status labels/tones as data, not branching:** `Record<ApplicationStatus, {label, tone}>` in `lib/applications/status.ts`. Design labels differ from DB enum (e.g. "Recruiter Responded" ↔ `recruiter_contacted`, "Fixed-term" ↔ `contract`); one mapping module prevents drift. Define the full map since the list can render any status.
3. **Responsive:** the design uses container queries (`@container vp (min-width:760px)`: 2-column `form-grid`, table-like list head, `.only-d/.only-m`). Recommend Tailwind `md:` variants, consistent with `AppTopBar`.
4. **Do not reuse** `authInputClassName`, `submitButtonClassName`, `AuthPageShell` (dark theme). **Do reuse** `visuallyHiddenClassName`, `Logo`, `SessionCheckFailed`, `requireSession`.
5. **Tokens:** adopt the design's token set wholesale (§4b, decided). Contrast ratios are annotated in the design (text 17.4:1, text-3 6.4:1) — keep them for the a11y requirement.
6. **Side nav is in scope (decided by user):** build the design's main navigation for desktop **and** mobile. See §4a.

### 4b. Design tokens (decided: follow the new design)

The design's `:root` (lines 15–57) is the source of truth. Current `app/globals.css` vs design:

| Token (design name) | Design | Current | Action |
|---|---|---|---|
| `paper` | `#ffffff` | `#fbfaf7` | change value (used by `AccountSheet` `bg-paper`, `LogoutButton` uses `bg-white`) |
| `success-tint` | `#e4f5ec` | `#e3f4e8` | change value |
| `danger-text` | `#a32a21` | `danger-fg #8a271f` | **rename** `-fg` → `-text`, new value |
| `warning-text` | `#7a4a05` | `warning-fg #8a5608` | rename + new value |
| `success-text` | `#13633f` | `success-fg #1c5c34` | rename + new value |
| `navy #042c53`, `azure #1976d2`, `sky #b5d4f4`, `mist #e4f2ff`, `warning-tint #fbf0dc`, `danger-tint #fbe9e7` | same | same | keep |
| `cobalt/link #185fa5`, `danger #c0362c`, `success #1e8e5a`, `warning #b8710b`, `app-bg #f4f7fb`, `subtle #eceef1`, `border #d5dce6`, `border-strong #b9c3d0`, `text #0f1b2a`, `text-2 #3b4859`, `text-3 #526074`, `on-dark #fff`, `on-dark-2 #c9d8ea`, `on-dark-3 #9db0c6`, `neutral #5b6472`, `star` | — | missing | **add** |
| `auth-label/auth-danger/auth-warning(+ring)` | not in design token list | present | keep (dark auth-only; auth screens consume them via `components/auth/styles.ts`) — confirm the design's auth screens don't specify different values |

- **Blast radius of the rename (verified by grep):** `app/signup/SignupAlerts.tsx`, `app/login/LoginAlert.tsx`, `app/(protected)/_components/{LogoutButton,PasswordUpdatedToast,AccountSheet}.tsx` use `*-fg`/`paper`; no test or e2e file references these class names. Visual change only; contrast of the new values is higher (design annotates ratios), so safe for a11y.
- Do the token swap in one mechanical commit **before** feature work (find/replace `-fg`→`-text`), so later diffs are clean. Keep the design's mono/display/body font variables mapped: `--font-display`=Archivo, `--font-body`=Work Sans (already loaded in `components/auth/fonts.ts` — move font loading from `components/auth/` to root layout or `components/fonts.ts` since the app shell now needs them too; IBM Plex Mono for section labels is not loaded: either add via `next/font` or accept Geist Mono → decide in plan).
- Tailwind v4: register via `@theme inline` so utilities like `bg-app-bg`, `text-text-2`, `border-border-strong` exist (note `text-text` reads oddly: consider `ink`/`fg` aliases, or use the design names verbatim and accept it).

### 4c. Date field (decided: calendar picker, icon, default today, future allowed)

- **Behaviour:** the Applied date field shows the selected date (formatted, e.g. "17 Nov 2026" as in the design) with a **calendar icon** at the end. Click/Enter/Space on the field or icon opens a calendar popover; the user picks a day. **No typed input.** Default = today in the user's time zone (§6.2). Any day, including future days, is selectable. Selecting a day closes the popover and returns focus to the field.
- **Why not plain `<input type="date">`:** it permits typing segments, and the calendar icon/picker UI differs per browser (Safari/Firefox); the requirement is a visible icon and no typing everywhere.
- **Component:** reusable `DatePicker` in `components/ui/` (a `FormField` child; same label/help/error wiring). Submits through a hidden `<input name="applied_date" value="YYYY-MM-DD">`, so the Server Action and DB `date` column stay timezone-free ISO strings. The trigger is a `<button type="button" aria-haspopup="dialog" aria-expanded>` labelled by the field label, with the formatted value as its text; the field's required `*` and error/`aria-describedby` apply to it.
- **a11y:** popover is a dialog/grid with arrow-key day navigation, PageUp/PageDown months, Home/End week, Esc closes and restores focus, today and selected day announced (`aria-current="date"`, `aria-selected`), month/year in the heading as a live region, day buttons ≥ 44px on mobile; contrast per tokens.
- **Format:** display with `Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric' })` in a pure `formatDisplayDate(iso)`; storage stays ISO. Locale fixed to match the design; i18n is out of scope.
- **Validation consequence:** since typing is impossible, "invalid date" can only arise from a tampered POST; the server still validates (real calendar date, ISO format) and returns the same required/invalid message. Empty can occur only if the default is cleared — the picker has no "clear" action, so the required-field error for this field is effectively server-only.
- **Reuse:** Story 1.2 Closing date (same picker, optional, with a clear action and the non-blocking closing-before-applied warning), 1.6 note date, F3 reminders.
- **Tests:** renders today's date by default (injected clock); opens on click/Enter/Space; arrow keys move; selecting a future date works and updates hidden input; Esc restores focus; typing into the trigger does nothing; calendar icon is `aria-hidden` and present; hidden input value is ISO; form posts the ISO value; axe on open state. Wrapper-component tests must mock `react-day-picker` only if needed — prefer testing through real DOM.

### 4a. Main navigation (design screen "Main menu (web)", `scr-nav-drawer`; JS `NAV`, `siteHeader()`, `sideNav()`, CSS lines 452–711)

**Design spec**
- **Desktop (≥ 760px container; dev note says ≥ 768px → use Tailwind `md`):** fixed `side-nav`, 240px wide, navy, padding `22/14/18`, column with 4px gap: brand (logo 30 + "NextJobLog", Archivo 800 17px) → **Add application** button (azure, full width, plus icon) → nav items → **CV library** → **account row** pinned bottom (`margin-top:auto`, top border, avatar + email; opens the Log Out dialog — "centred dialog on desktop").
- **Items (data):** Dashboard (home), Applications (list), Calendar, Analytics, then CV library (file). Item = icon 19 + label, 15px/500, `on-dark-2`; hover `bg white/8`; **active** = `bg sky/16`, white, 600, `inset 3px sky` left bar.
- **Mobile:** `site-header` 56px navy: hamburger (40px, `aria-label="Open menu"`, `aria-expanded`, `aria-controls`) · logo + "NextJobLog" (flex-1) · **Add** button (azure, plus icon) · account avatar (34px, opens the existing bottom sheet). The hamburger opens a **drawer**: overlay `rgba(1,8,18,.5)`, panel 82% / max 300px, navy, with a close button (40px, `aria-label="Close menu"`) and **exactly the same items** as the side nav.
- **Dev notes from the design:** one `<nav aria-label="Main">` component rendered as side nav at ≥768px and inside the drawer below it; same links/order/active state. While open: focus moves into the drawer, Esc or backdrop tap closes, focus returns to the menu button; close on route change; Add stays visible in the header on every page; Account opens the same account sheet as before (Story 0.5); real URLs, normal browser back.

**Current app vs design** (`app/(protected)/_components/*`, `layout.tsx`)
- Today: `AppTopBar` (navy bar, text "NextJobLog", `AccountControls`: avatar → bottom sheet below `md`; email chip + inline Log Out from `md`). `layout.tsx` stacks bar + page in `flex-col`. No nav links, no Add, no Dashboard/Applications links.
- **Reusable as-is:** `useLogout`, `LogoutButton`, `AccountSheet` focus handling + `useDialogKeyboardNavigation`, `deriveAccountInitial`, `SessionExpiryNotice`/`PasswordUpdatedToast` (stay mounted in the shell; `suspended` signal keeps two modals from coexisting — extend it to the drawer too), `Logo` (add `size`/aria options; the design's logo has `role="img" aria-label="NextJobLog"` in the header).
- **Must change:** `AppTopBar` is replaced by `SiteHeader` (mobile only, `md:hidden`) + `SideNav` (`hidden md:flex`); `AccountControls` desktop branch (inline Log Out) becomes the side-nav account row; `AccountSheet`'s overlay is hard-coded `md:hidden` — it needs a **desktop centred-dialog variant** (design: "Bottom sheet on small screens, centred dialog on desktop"); `layout.tsx` becomes `flex` row (nav + `<div class=main>`), main scrolls, `content-inner max-w-[1080px]`.
- **Existing tests/e2e affected** (update, don't delete): `__tests__/protected/{AccountControls,AccountMenu,layout}.test.tsx`, `e2e/logout.spec.ts`, `e2e/session-expiry.spec.ts` (they likely target the inline "Log Out" / "Account" controls). Check selectors before refactoring.

**Proposed design of the nav (SOLID / a11y)**
- `lib/navigation/nav-items.ts` — **data**: `NAV_ITEMS: readonly {id, label, href, icon}[]` (OCP: adding Calendar later = one entry). Pure `isNavItemActive(pathname, href)` (prefix match on segment boundary, so `/applications/new` and `/applications/123` keep *Applications* active but `/applications-x` does not) — unit-tested.
- `components/ui/icons.tsx` — icon set as small components (`HomeIcon`, `ListIcon`, `PlusIcon`, `MenuIcon`, `CloseIcon`, `FileIcon`, …) ported from the design's `IC` map, `aria-hidden`, `size` prop; replaces the per-file inline SVG duplication already visible in `SignupAlerts`.
- `MainNav` — **one** `<nav aria-label="Main">` containing the items (`<Link aria-current="page">` for the active one, icon + label). Rendered **once**, not twice, to avoid duplicate landmarks/ids and double tab stops: the container is the static sidebar at `md:` and the off-canvas drawer below `md` (CSS-only layout change; closed state uses `hidden` so it is not focusable). Alternative (render twice, `md:hidden` / `hidden md:flex`) is simpler to style but duplicates the landmark — avoid.
- `SideNav` (brand, `AddApplicationLink`, `MainNav`, `AccountRow`), `SiteHeader` (hamburger, brand, Add, `AccountMenu` trigger), `NavDrawer` behavior in a hook `useNavDrawer` (open state, Esc, focus-in/return, close-on-pathname-change, body scroll lock, backdrop click) reusing `useDialogKeyboardNavigation` for the focus trap. State lives in `ProtectedAppShell` (already the client "modal owner").
- Drawer is a modal dialog on mobile (`role="dialog" aria-modal` on the panel, or `<nav>` inside a dialog wrapper) — decide in plan; it must be inert to the page behind (`aria-modal` + focus trap).
- Contrast: items `#c9d8ea` on `#042c53` and sky/16 active state — verify ≥ 4.5:1 (design lists `on-dark-2`).
- **Which items to show now:** only routes that exist (Dashboard, Applications). Calendar, Analytics, CV library have no pages; dead links would 404. Data-driven list lets later stories append entries. (Open Question 1b.)

**Deviations from the mock that improve a11y/correctness (need sign-off):** a **calendar `DatePicker`** (decided, §4c) instead of the mock's text input "17 Nov 2026"; `<input type="url">` with `noValidate` on the form so our messages show instead of the browser's. The mock's `choice-pill` buttons lack `aria-pressed`/radio semantics — relevant to 1.2, not now.

## 5. Proposed structure (Next.js best practice: colocate by route, share by domain)

Navigation shell (new, in scope):
```
app/(protected)/layout.tsx            # flex row: nav + main; keeps session/toast wiring
app/(protected)/_components/
  ProtectedAppShell.tsx               # owns drawer-open + notice-open state
  SideNav.tsx  SiteHeader.tsx  NavDrawer.tsx  AccountRow.tsx  AddApplicationLink.tsx
  useNavDrawer.ts                     # Esc, focus in/return, close on route change
  AccountSheet.tsx                    # + centred-dialog variant for md+
  (AppTopBar.tsx removed)
components/navigation/MainNav.tsx     # single <nav aria-label="Main">
components/ui/icons.tsx
lib/navigation/nav-items.ts           # NAV_ITEMS data + isNavItemActive()
lib/applications/paths.ts             # APPLICATIONS_PATH, NEW_APPLICATION_PATH (shared with nav)
```
Feature routes:
```
app/(protected)/applications/
  page.tsx                      # list; requireSession; empty state
  new/page.tsx                  # form page; requireSession; passes today's date
  _components/                  # private, route-specific
    ApplicationForm.tsx         # client container: useActionState + focus mgmt
    ApplicationFormFields.tsx   # presentational, reusable for Edit / 1.2
    ApplicationList.tsx, ApplicationRow.tsx
    SaveFailedAlert.tsx
app/actions/applications.ts     # thin "use server": auth → deps → service
components/ui/                  # Button, Card, Alert, ErrorSummary, FormField,
                                #   TextInput, DatePicker, PageHeader, SectionLabel, StatusBadge, EmptyState
lib/applications/
  types.ts                      # ApplicationStatus, NewApplicationInput, FieldErrors
  paths.ts                      # APPLICATIONS_PATH, NEW_APPLICATION_PATH
  validation.ts                 # pure; declarative REQUIRED_FIELDS rules
  messages.ts                   # all user-facing strings
  status.ts                     # label/tone map, INITIAL_APPLICATION_STATUS
  dates.ts                      # todayInTimeZone(now, tz), isValidIsoDate, formatDisplayDate
  log-application.ts            # service: deps {repository, now}, input → result
  repository.ts                 # insertApplication(client, …), listApplications(client)
supabase/migrations/<ts>_default_application_status_applied.sql   (+ copy to supabase-test/)
__tests__/{lib/applications,actions,applications,components/ui}/…
e2e/applications.spec.ts
```

### SOLID mapping
- **S:** validation, date logic, persistence, orchestration, action wiring, and each UI piece are separate modules.
- **O:** `ApplicationFormFields` takes slots; `REQUIRED_FIELDS` is a declarative `{name, label, validate}` list so 1.2 adds rules without editing the validator loop; `Alert`/`Button` variants are data-driven.
- **L:** an `ApplicationRepository` interface — Supabase implementation and in-memory fake are interchangeable in tests.
- **I:** the service depends on a one-method `insert` interface, the list on `list`; no component receives the whole Supabase client.
- **D:** `logApplication({ repository, now }, input)` mirrors `requestPasswordReset(deps, input)`; the action is the only place that builds real deps.

## 6. Technical risks / gotchas

1. **React 19 resets uncontrolled forms after a `<form action>` completes.** That would wipe the user's input on save failure, violating the AC. Return submitted `values` in action state and render `defaultValue` from them (with a `key` tied to the submission), or use controlled inputs. Needs an explicit test.
2. **"Today" and time zones.** Server `new Date()` is UTC; a Stockholm user at 00:30 gets yesterday. Compute with `Intl.DateTimeFormat('en-CA', { timeZone })` from `profiles.timezone` (fallback `Europe/Stockholm`, same as the DB default). Pure function with injected clock, tested at midnight/DST boundaries. This date seeds the 7-day and 14-day reminders (F3), so correctness matters beyond display.
3. **URL validation.** Use `new URL()` and require `http:`/`https:` — `"linkedin job"` throws, but `javascript:alert(1)` and `ftp://` parse fine and must be rejected (the link will be rendered as `<a href>` later → XSS vector). Trim input; whitespace-only = empty. Propose max lengths (2048 for URL, 200 for text; precedent `MAX_NEXT_LENGTH`) — not in schema/ACs, needs sign-off.
4. **Server is authoritative.** Client pre-validation (like `SignupForm.handleSubmit`) is UX only; the action re-validates with the *same* pure module. Never trust a posted `status` or `user_id` — set both server-side. Next docs warn to re-verify auth inside each Server Action: call `requireSession()`/read `claims.sub` in the action.
5. **Redirect after save:** `redirect()` throws; keep it outside `try/catch`.
6. **Focus management:** after a failed submit, focus the first invalid field in an effect keyed on error state; summary links target the same ids. Test `document.activeElement` and that `aria-describedby` resolves to the error text.
7. **Double submit / retry:** disable Save while pending; Retry is a `type="submit"` button. A retry after a timeout where the first insert actually succeeded creates a duplicate. Mitigation: client-generated UUID in a hidden input used as the row `id` (idempotent by primary key, no schema change).
8. **Migration drift:** manual copy to `supabase-test/` (README warns).
9. **Input safety:** see §6a below (SQL injection, mass-assignment, NUL bytes, XSS via `posting_url`).
10. **Navigation shell is the riskiest part of the change** because it replaces chrome that auth/session features depend on: the session-expiry notice and logout flows must keep working (`useLogout` instance must stay mounted while the sheet/dialog closes — see the comment in `AccountControls`), and two `aria-modal` layers (drawer, account sheet, expiry dialog) must never coexist (extend the existing `suspended` mechanism). Do it as its own slice with its own tests before the feature slices.
11. **Hydration/viewport:** do not branch on `window.innerWidth` in JS; use CSS breakpoints and a single DOM instance of the nav to avoid hydration mismatches and duplicate landmarks. `usePathname` makes `MainNav` a client component — keep the surrounding layout a Server Component.
12. **Coverage trap:** Server Actions importing `next/headers` need the mock pattern in `__tests__/actions/*.test.ts`; keep the action thin so logic lives in pure, easily covered modules.

### 6a. Input safety / SQL injection (requested by user, 19 Nov 2026)

**Why injection is not possible by construction (and what keeps it that way)**
- All writes go through `supabase-js` `.insert({...})`, which sends a JSON body to PostgREST; PostgREST binds values as **typed parameters**, never concatenating them into SQL. A title like `'; drop table applications;--` is stored as that literal text.
- The new DB trigger (§3a) copies `new.*` columns only and uses **no dynamic SQL** (`execute`/`format`), so no value is ever interpreted as SQL.
- RLS (`auth.uid() = user_id`) is a second wall: even a successful bug could only touch the caller's own rows.

**Rules to enforce (so a later change can't break the guarantee)**
1. **No string-built SQL anywhere:** no `rpc` functions that concatenate input, no raw `sql`, no `execute format('…%s…')` in migrations for this feature. Lint-style test greps `lib/applications/**` and `app/actions/applications.ts` for template-literal SQL keywords.
2. **Explicit column mapping:** the repository builds the insert object field-by-field from the *validated* input (`title, company, applied_date, location, posting_url`) plus server-set `user_id`, `status`, `id`. Never `Object.fromEntries(formData)` or object spread — blocks mass-assignment of `status`, `user_id`, `created_at`.
3. **Type-check FormData values:** `formData.get()` may return a `File` or `null`; accept only `typeof value === "string"`, else treat as empty (existing pattern in `app/actions/password-reset.ts`).
4. **Reject, don't "sanitize", structure:** validation allowlists the shape (length, ISO date regex + real date, `http(s)` URL). Do **not** strip quotes or escape SQL characters — that corrupts legitimate names ("O'Brien & Sons", "Müller AG") and gives false security.
5. **Strip/reject control characters:** a `\u0000` (NUL) in text makes Postgres error ("invalid byte sequence") → a 500 and a confusing "save failed". Reject NUL and other C0 control characters (keep tab/newline out of single-line fields) with the field's validation message. Normalize to NFC and trim.
6. **Future search/filter story (1.11):** this is where injection-like risk really appears — PostgREST `.or('title.ilike.%${q}%')` interpolates user text into a *filter expression* (can alter the query with `,`/`)`/`.`). Not in this change, but note for planning: use `.ilike('title', pattern)` with a separately escaped pattern, never `.or()` with raw input.
7. **Output side (XSS, the real risk for this data):** React escapes text, so titles render safely; the only dangerous sink is `posting_url` as `href` → the `http(s)` allowlist (§6.3) is mandatory and is re-checked **at render time** in `ApplicationRow`/detail too (defence in depth, because older rows or future import paths may bypass the form). Add `rel="noopener noreferrer" target="_blank"` for external links.
8. **Errors must not leak SQL:** the action maps any Supabase/Postgres error to the generic "Couldn't save" state and logs details server-side only (pattern: `lib/auth/log.ts`, `error-details.ts`); never return `error.message` to the client.
9. **Length caps before the DB** (200 / 2048, decided) also bound payload size.

**Tests to add (security)**
- Payload table run through `validateApplicationInput` and the service with a fake repository: `'; drop table applications;--`, `" OR 1=1 --`, `Robert'); DROP TABLE students;--`, `%`, `_`, backslashes, emoji, 10 000-char string, NUL byte, `<script>alert(1)</script>`, `javascript:alert(1)`, `data:text/html,…`, `file:///etc/passwd`. Assert: lengths/NUL/scheme rejected with field errors; benign SQL-looking text **is accepted and passed verbatim** (no mangling).
- Repository test: inserted object has exactly the 8 expected keys; extra posted keys (`status=rejected`, `user_id=…`, `id` spoof, `created_at`) are ignored.
- **Real-DB test** (SQL test + one Playwright case against local Supabase): save `Robert'); DROP TABLE applications;--` as Title → row stored literally, table intact, list renders it as text, no script execution.
- Static test: no file in the feature uses `.rpc(`, `.or(` or SQL template strings with interpolation.

## 7. Test plan (target ≥ 80% overall, ≥ 90% on `lib/applications/**`)

- **Unit (pure):** `validation` (each field empty/whitespace; invalid URLs `"linkedin job"`, `javascript:`, `ftp:`, no host; valid http/https; impossible dates `2026-02-30`; max lengths; all errors returned together in form order); `dates.todayInTimeZone` (UTC vs Stockholm around midnight, DST); `status` map covers every enum value.
- **Service:** fake repository — success sets `status: 'applied'` and trimmed values; validation failure never calls repository; repository error → `{status:'error', values}`.
- **Action:** mock `next/headers`/`redirect`; FormData parsing; ignores injected `status`/`user_id`; redirects on success; returns state on failure; rejects without a session.
- **Components (RTL + user-event):** form shows today's date; empty submit → 5 messages, focus on first invalid, `aria-invalid`/`aria-describedby`; bad URL message contains `https://`; failure keeps values and shows Retry; Retry resubmits; Save disabled while pending; Enter submits; `FormField`, `Alert`, `StatusBadge`, `EmptyState`, `ApplicationRow` by role (no brittle snapshots).
- **Pages:** list renders rows newest-first, empty state when none, `SessionCheckFailed` on verification failure (pattern: `__tests__/dashboard/page.test.tsx`). The guard test passes if pages call `requireSession`.
- **e2e (Playwright, existing `seedConfirmedUser`/`supabaseAdmin`):** log in → add → appears in list with "Applied"; a second user does not see it (RLS).
- **DB:** SQL test beside `supabase/tests/database/rate_limit_consume.test.sql`: default status is `applied`; insert with another user's `user_id` is rejected.
- **Navigation:** `isNavItemActive` (exact, nested, sibling-prefix false positive, trailing slash, query-less); `MainNav` renders one landmark with `aria-current="page"` on the active link; `SiteHeader` hamburger `aria-expanded` toggles, opens drawer, focus moves in, Esc closes and returns focus to the hamburger, backdrop click closes, route change closes, Tab is trapped; `SideNav` shows Add link → `/applications/new` and account row opens the dialog; only one of header/side-nav visible per breakpoint is a CSS concern → assert both exist in DOM and cover visibility in Playwright with viewport 375 vs 1280; update existing `AccountControls`/`AccountMenu`/`layout` tests and logout/session-expiry e2e selectors.
- **e2e nav:** at 1280px side nav visible, click Applications → active state; at 375px menu button → drawer → Applications → drawer closes; Add reaches the form at both sizes; log out works from the side-nav account row and from the avatar sheet.
- **a11y:** `axe-core` check on the form in error state (new dev dependency, needs approval) or `@axe-core/playwright`.

## 8. Open questions (answer before planning)

1. ~~Navigation entry point~~ **Decided (user, 19 Nov 2026):** build the side nav per design for desktop and mobile (§4a). Remaining sub-questions:
   - ~~1b.~~ **Decided (user: "go with your recommendations", 19 Nov 2026)):** show only existing routes (Dashboard, Applications); later stories append entries to `NAV_ITEMS`.
   - ~~1c.~~ **Decided (user: "go with your recommendations", 19 Nov 2026)):** Tailwind `md` (768px) viewport breakpoint, matching `AccountControls` today.
   - ~~1d.~~ **Decided (user: "go with your recommendations", 19 Nov 2026)):** both "Add" (mobile header) and "Add application" (side nav) are real links to `/applications/new`.
2. ~~Status history on create~~ **Decided (user, 19 Nov 2026): yes.** Creating an application also writes the first `status_history` row (`status = 'applied'`, `changed_at` = creation time). See §3a.
3. ~~Token reconciliation~~ **Decided (user, 19 Nov 2026): follow the new design.** The design's tokens become the single source of truth; existing conflicting values are replaced. See §4b.
4. ~~Future applied date~~ **Decided (user, 19 Nov 2026):** future dates are selectable; the field is a calendar picker with a calendar icon, no typed text, defaulting to today (§4c). **Max lengths: decided (user, 19 Nov 2026)** — Title/Company/Location ≤ 200 characters, Job posting link ≤ 2048; over-limit shows a per-field error like the required-field errors. Also confirm the reading of "No text here" (4b below).
   - ~~4b.~~ **Decided (user, 19 Nov 2026): picker only** — no typed text in the date field. The helper line "Defaults to today. Change it if you applied earlier." stays as in the design.
   - ~~4c.~~ **Decided (user, 19 Nov 2026): add `react-day-picker`** (new runtime dependency; pin an exact version at plan time and verify React 19 / Tailwind v4 compatibility and its bundled stylesheet vs our design tokens — style via its classNames/CSS variables, not its default theme).
5. ~~Idempotency~~ **Decided (user, 19 Nov 2026): yes** — the form generates a UUID on open and posts it as a hidden field; the server uses it as the row `id`. A retry with an already-existing id owned by the same user is treated as success (select-by-id check or unique-violation `23505` + ownership check), not as an error. Server validates it is a well-formed UUID; a malformed or missing one gets a server-generated id.
6. ~~Scope of `components/ui/`~~ **Decided (user: "go with your recommendations", 19 Nov 2026)):** only components used by this story; `SignupAlerts`/auth components are not refactored here.
7. ~~Schema doc~~ **Decided (user: "go with your recommendations", 19 Nov 2026)):** leave the staged deletion of `supabase/docs/Nextjoblog-supabase-schema.md` as the user left it (not touched by this change); the new migration is the record of the default-status and history-trigger decisions.
8. ~~Design drift outside this story~~ **Decided (user: "go with your recommendations", 19 Nov 2026)):** the `source_website` / fit-column cleanup is a separate change, not part of 1.1 (design dev notes: `source_website` removed 16 Nov; `fit_*` dropped 18 Nov; migrations still have them — optional columns, so Story 1.1 is unaffected).

## 9. Suggested next step

All §8 questions are decided. Run `/10x-plan log-a-new-application-with-required-fields`. TDD slice order: **token swap (mechanical)** → migration (default `applied` + history-insert trigger) + SQL tests → **navigation shell** (nav-items, icons, `MainNav`, `SideNav`/`SiteHeader`/drawer, account dialog variant, update existing tests) → `lib/applications` pure modules → service/repository → action → `components/ui` → form/list pages → e2e.

*Note: the `/10x-research` skill file reached me as a compressed archive I couldn't read, so this document follows the structure of your request rather than the skill's own template.*
