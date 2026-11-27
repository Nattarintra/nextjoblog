---
date: 2026-11-26T13:44:29+01:00
researcher: Natta
git_commit: d1e2e36c4e1c4d28da4e53dbc82f89384ae70692
branch: feature/view-application-list-and-details
repository: nextjoblog
topic: "Applications Feature 1 design analysis for view-application-list-and-details"
tags: [research, codebase, applications, supabase, nextjs-16, tailwind, a11y, testing]
status: complete
last_updated: 2026-11-26
last_updated_by: Natta
last_updated_note: "Resolved the four open questions for Story 1.4"
---

# Research: Applications Feature 1 design analysis

**Date**: 2026-11-26T13:34:06+01:00  
**Researcher**: Natta  
**Git Commit**: `d1e2e36c4e1c4d28da4e53dbc82f89384ae70692`  
**Branch**: `feature/view-application-list-and-details`  
**Repository**: `nextjoblog`

## Research Question

Research `view-application-list-and-details`: inspect the story in `context/changes`, the existing Next.js codebase, the Applications Feature 1 design section in `supabase/docs/nextjoblog-mvp-screens.html`, and the Supabase schema/data-access implementation. Identify reusable components, SOLID/maintainability boundaries, accessibility/performance requirements, and a test strategy meeting at least 80% coverage, with exact file/line references.

## Summary

The repository already contains the Story 1.1/1.2 foundation for `/applications` and `/applications/[id]`: protected server pages, Supabase reader ports, newest-first list ordering, reusable cards/headers/status badges/empty states, safe external posting links, formatted optional values, and `notFound()` handling. The current implementation is intentionally narrower than the full Feature 1 design. The exact schema path supplied in the request (`supabase/docs/Nextjoblog-supabase-schema.md`) is absent; the repository contains the English schema at `supabase/docs/nextjoblog-supabase-schema-en.md` plus the migrations, which were used as the authoritative sources.

The design section defines three distinct scopes:

1. Story 1.4 list/detail baseline: list rows with title, company, location, applied date and status; newest-first ordering; row navigation to `/applications/[id]`; first-use empty state; detail hero and saved job fields; missing optional values rendered as `—`; deleted/invalid detail links show “Application not found”.
2. Adjacent list stories 1.11–1.13: search, one status filter, URL-persisted query state, result announcements, and filtered-empty variants. These are present in the design but are not part of the current change story’s acceptance criteria.
3. Adjacent detail stories 1.5–1.7 and later features: recruiter contact, conversation notes, status history, rejection feedback, and CV/cover-letter links. The schema has data for some of these, but the current TypeScript model and detail reader do not select them.

The implementation should preserve the existing separation of concerns: route pages compose injected repository readers, `lib/applications` owns pure view-model/formatting rules, and small `components/ui` primitives own visual/a11y behavior. The existing test configuration already enforces at least 80% globally and 90% for `lib/applications/**`.

## Detailed Findings

### 1. Design composition and reusable visual patterns

- The design uses a shared `list-topbar` for the Applications title, subtitle, List/Board segmented control, and Add application action (`supabase/docs/nextjoblog-mvp-screens.html:3093-3105`). Reuse the existing `PageHeader` title/subtitle/actions slot rather than duplicating route-specific header markup (`components/ui/PageHeader.tsx:7-35`; `app/(protected)/applications/page.tsx:44-55`).
- List rows are a card-contained semantic list. Desktop has four columns—Role · Company, Location, Applied, Status—while mobile collapses to a two-column row with metadata below (`supabase/docs/nextjoblog-mvp-screens.html:3129-3147`, `supabase/docs/nextjoblog-mvp-screens.html:3148-3183`). Current `ApplicationList` already renders a `Card` containing a labelled `<ul>` and maps rows (`app/(protected)/applications/_components/ApplicationList.tsx:14-37`); `ApplicationRow` already separates title/company, metadata and status (`app/(protected)/applications/_components/ApplicationRow.tsx:10-29`).
- The design makes each row itself navigable (`supabase/docs/nextjoblog-mvp-screens.html:3131-3138`). The current implementation makes the title a real `next/link` to `applicationDetailPath(id)`, which is the safer semantic equivalent and keeps the external posting link separate (`app/(protected)/applications/_components/ApplicationRow.tsx:14-27`; `lib/applications/paths.ts:1-3`).
- `Card`, `EmptyState`, `SectionLabel`, `StatusBadge`, `Chip`, `PageHeader`, and button variants already map directly to the design’s card, empty, section, badge, chip, topbar, and button patterns (`components/ui/Card.tsx:3-8`, `components/ui/EmptyState.tsx:9-21`, `components/ui/StatusBadge.tsx:5-19`, `components/ui/Button.tsx:6-68`).
- The detail design is compositionally split into a main column and side column: hero + Job details + conversation notes on the left; recruiter + status history + CV/cover letter on the right (`supabase/docs/nextjoblog-mvp-screens.html:3414-3527`, `supabase/docs/nextjoblog-mvp-screens.html:3529-3542`). The current route composes only `ApplicationHero` and `JobDetailsCard` (`app/(protected)/applications/[id]/page.tsx:47-53`).
- The current detail primitives already implement the reusable hero, definition-list rows, chips and safe posting link (`app/(protected)/applications/[id]/_components/ApplicationHero.tsx:10-31`, `app/(protected)/applications/[id]/_components/JobDetailsCard.tsx:10-27`, `app/(protected)/applications/[id]/_components/DefinitionList.tsx:5-23`, `app/(protected)/applications/_components/PostingLink.tsx:11-23`).

### 2. Responsive requirements

- The source design is mobile-first and switches desktop behavior at a 760px container breakpoint (`supabase/docs/nextjoblog-mvp-screens.html:433-445`). The codebase’s established Tailwind breakpoint is `md`; prior research explicitly decided to use the 768px `md` breakpoint (`context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:252-255`). Keep the breakpoint consistent with the app shell rather than introducing a second breakpoint.
- Mobile hides desktop-only actions/nav, uses a back button, stacks list metadata, and lets the status filter row scroll horizontally (`supabase/docs/nextjoblog-mvp-screens.html:435-445`, `supabase/docs/nextjoblog-mvp-screens.html:1177-1199`, `supabase/docs/nextjoblog-mvp-screens.html:1252-1288`). Desktop shows the 240px side nav and expands the list into a four-column grid (`supabase/docs/nextjoblog-mvp-screens.html:683-710`, `supabase/docs/nextjoblog-mvp-screens.html:1289-1317`).
- Detail is one column on mobile and a `1.6fr / 1fr` main/sidebar grid on desktop, with a minimum 280px side column (`supabase/docs/nextjoblog-mvp-screens.html:1349-1365`). Mobile places Edit/Delete below the hero; desktop keeps them in the topbar (`supabase/docs/nextjoblog-mvp-screens.html:3400-3411`, `supabase/docs/nextjoblog-mvp-screens.html:3423-3428`).
- Shared content behavior is already centralized in `PageHeader` and the protected shell; the route uses a responsive max-width content container (`app/(protected)/applications/page.tsx:44-69`, `app/(protected)/applications/[id]/page.tsx:47-53`).

### 3. Accessibility requirements

- The design labels search and status controls (`supabase/docs/nextjoblog-mvp-screens.html:3115-3124`) and announces result changes with `role="status"` (`supabase/docs/nextjoblog-mvp-screens.html:3126-3128`). If search/filter is implemented in this change, preserve a labelled search input, a single-select status group with `role="radiogroup"`/`role="radio"` and accurate `aria-checked`, and a live result count. The design’s “Clear search”/“Clear all” controls need explicit accessible names (`supabase/docs/nextjoblog-mvp-screens.html:3115`, `supabase/docs/nextjoblog-mvp-screens.html:3127`).
- Row navigation must be keyboard reachable with a visible focus style and a target large enough for touch. The current title link already supplies a visible `focus-visible` outline and `min-h-11` target (`app/(protected)/applications/_components/ApplicationRow.tsx:16-18`). Keep the external posting link distinct and use the existing `aria-label`, `target="_blank"`, and `rel="noopener noreferrer"` defense (`app/(protected)/applications/_components/PostingLink.tsx:15-22`).
- Detail fields use semantic `<dl>`, with empty values represented visually by `—` and announced as “Not provided” (`app/(protected)/applications/[id]/_components/DefinitionList.tsx:5-23`; design example `supabase/docs/nextjoblog-mvp-screens.html:3431-3460`). Never render `null`, an empty unlabeled box, or an empty chip.
- Page and route structure follows current Next.js App Router conventions: `app/(protected)/applications/page.tsx` maps to `/applications`, `_components` is private, and `[id]/page.tsx` maps to `/applications/[id]` (`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:53-99`). Dynamic route params are promises in this Next version and must be awaited (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md:16-29`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md:146-149`), matching the current page (`app/(protected)/applications/[id]/page.tsx:21-28`).
- Invalid or missing records should use `notFound()` and the app’s not-found UI. Next’s `not-found` convention is the correct response to a route-segment `notFound()` throw (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:6-15`). The design specifically wants an application-specific “Application not found” card with back-to-list and dashboard actions (`supabase/docs/nextjoblog-mvp-screens.html:3695-3715`); this should be reconciled with the current global `app/not-found.tsx` behavior before implementation.
- Protected pages must call `requireSession()` and handle verification failure before querying data (`app/(protected)/applications/page.tsx:27-42`, `app/(protected)/applications/[id]/page.tsx:21-45`). Prior research treats this as a guard-test invariant (`context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:41-47`).

### 4. URLs and data boundaries

- Canonical routes are `/applications`, `/applications/new`, and `/applications/{id}` (`lib/applications/paths.ts:1-3`). The design also shows `/applications/{id}/edit`, `/applications?q=...&status=...`, and `/applications?view=board` for adjacent stories (`supabase/docs/nextjoblog-mvp-screens.html:4070-4077`, `supabase/docs/nextjoblog-mvp-screens.html:4203`). Do not add edit, board, or filter URL state silently unless the implementation scope is expanded.
- The list reader selects only summary fields and orders by `applied_date desc`, then `created_at desc`, capped by `LIST_PAGE_SIZE` (`lib/applications/repository.ts:20-27`, `lib/applications/repository.ts:98-111`). The current cap is 50 (`lib/applications/limits.ts:3-5`), while Story 1.4 says up to 500 without pagination. This is a material requirement mismatch: either raise the cap for this story or explicitly retain the existing safety cap and revise the acceptance criterion. The design says “No pagination up to 500 rows” in its implementation notes (`supabase/docs/nextjoblog-mvp-screens.html:4067-4071`).
- The schema has indexes for owner, owner/status, and owner/applied date (`supabase/docs/nextjoblog-supabase-schema-en.md:102-141`). RLS scopes `applications`, `status_history`, and `conversation_notes` to `auth.uid() = user_id` (`supabase/docs/nextjoblog-supabase-schema-en.md:219-221`, `supabase/docs/nextjoblog-supabase-schema-en.md:273-287`). Query through the cookie-bound server client so RLS remains authoritative (`app/(protected)/applications/page.tsx:27-32`, `app/(protected)/applications/[id]/page.tsx:30-33`).
- The schema’s application record includes recruiter name/contact and rejection reason (`supabase/docs/nextjoblog-supabase-schema-en.md:98-140`), plus related status history and conversation notes tables (`supabase/docs/nextjoblog-supabase-schema-en.md:155-215`). Current `ApplicationDetail` only models the core and optional job-detail fields (`lib/applications/types.ts:47-67`), and `DETAIL_COLUMNS` excludes recruiter/rejection fields (`lib/applications/repository.ts:24-27`, `lib/applications/repository.ts:114-127`). Therefore “every saved field” cannot be met for the full schema without extending types, select columns, and detail components—or the story must explicitly limit itself to the currently implemented application fields.

### 5. Edge states and error behavior

- First-use empty list: the design requires a prompt, explanatory text, and Add application CTA (`supabase/docs/nextjoblog-mvp-screens.html:3190-3207`). Current `ApplicationList` already reuses `EmptyState` and links to `/applications/new` (`app/(protected)/applications/_components/ApplicationList.tsx:14-27`).
- Filtered empty list: the design has a distinct “No applications match …” state, names active search/status conditions, and offers Clear all; it also documents search-only and status-only messages (`supabase/docs/nextjoblog-mvp-screens.html:3209-3237`). This is adjacent Story 1.11–1.13 behavior, not currently implemented by `ApplicationList`.
- Missing optional fields: the design shows `Contract type —` (`supabase/docs/nextjoblog-mvp-screens.html:3431-3460`), and the current `DefinitionRow` supplies both the dash and screen-reader label (`app/(protected)/applications/[id]/_components/DefinitionList.tsx:9-21`).
- Deleted/bookmarked detail: the design requires “Application not found” with Back to applications and Go to Dashboard (`supabase/docs/nextjoblog-mvp-screens.html:3695-3715`). Current detail page calls `notFound()` for malformed UUIDs or a missing row (`app/(protected)/applications/[id]/page.tsx:27-45`), and tests cover both cases (`__tests__/applications/detail.test.tsx:51-55`). Verify the rendered `app/not-found.tsx` content matches the feature-specific design rather than only the exception path.
- Load failure is a separate error from not-found: the current page logs a safe, code-only event and renders an alert (`app/(protected)/applications/[id]/page.tsx:30-41`); list loading follows the same pattern (`app/(protected)/applications/page.tsx:27-33`, `app/(protected)/applications/page.tsx:56-65`). Preserve generic user copy and do not expose provider error messages.
- Unsafe or stale posting URLs must not become links. `PostingLink` re-validates at render time (`lib/applications/url.ts:1-9`, `app/(protected)/applications/_components/PostingLink.tsx:11-23`), and both list/detail tests cover unsafe URLs (`__tests__/applications/list.test.tsx:94-106`, `__tests__/applications/detail.test.tsx:64-68`).

### 6. SOLID/maintainability implications

- Single responsibility is already visible: pages guard/load/compose, repository owns Supabase reads, `detail-view.ts` formats pure display rows, and UI primitives own markup (`app/(protected)/applications/[id]/page.tsx:21-55`, `lib/applications/repository.ts:98-127`, `lib/applications/detail-view.ts:15-49`). Extend through data tables/view models and composable slots rather than adding field-specific branches to route pages.
- Open/closed behavior is established by `JOB_DETAIL_ROWS` and `buildJobDetailRows()` (`lib/applications/detail-view.ts:15-40`) and by declarative status display mapping (`lib/applications/status.ts:3-18`). New display fields should update a model/table and its tests, not duplicate formatting logic in multiple components.
- Dependency inversion is established by reader ports and factories (`lib/applications/ports.ts` and `lib/applications/repository.ts:98-127`), with page tests injecting mocked readers (`__tests__/applications/list.test.tsx:4-24`, `__tests__/applications/detail.test.tsx:4-22`). Keep filtering/sorting pure where possible and inject the repository/client boundary.
- Prior research explicitly recommends reusable UI primitives, pure validators, DI services, and avoiding auth-only dark-theme components for the light application UI (`context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:19-24`, `context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:69-90`).

## Testing Implications

### Minimum automated coverage

- The global Vitest V8 thresholds are 80% for lines/statements/functions/branches; `lib/applications/**` is stricter at 90% (`vitest.config.mts:13-33`). The change request’s “at least 80%” is therefore already a repository gate, but new pure application modules should meet the existing 90% domain gate.
- Current list tests cover newest-first rendering as returned, the 50-row cap message, first-use empty state, load error, session failure, safe external links, and unsafe URLs (`__tests__/applications/list.test.tsx:53-107`). Add assertions for every changed branch rather than relying on snapshots.
- Current detail tests cover hero/details/safe link, malformed and missing UUID not-found, load failure with safe logging, unsafe URL omission, and session verification failure (`__tests__/applications/detail.test.tsx:39-75`). Extend only for behavior added by this change: all saved fields in scope, exact feature-specific not-found actions, and any list-to-detail navigation state.
- Repository tests lock the list query’s selected columns and ordering, the detail query’s selected columns, missing rows, malformed IDs, and error mapping (`__tests__/lib/applications/repository.test.ts:117-176`). If the 500-row requirement is adopted, update `LIST_PAGE_SIZE`, query tests, and performance/e2e coverage together.

### Recommended test matrix

- Unit: table-driven status labels, display-date formatting, optional-value normalization, safe URL policy, and any pure search/filter predicate/query-state codec.
- Component: row semantics and keyboard focus; status radio semantics; horizontal filter overflow at mobile width; result `role="status"`; first-use empty; search-only/status-only/combined filtered-empty; detail definition rows including null/empty arrays; safe posting URL.
- Route/integration: authenticated list, list load error, detail success, malformed UUID, missing/foreign UUID under RLS, detail load error, and back-to-list link. Assert the server reader is not called after failed session verification.
- E2E/a11y: desktop and 375px/mobile viewports, axe scan of populated/empty/not-found states, keyboard-only traversal, direct bookmarked detail URL, and a 500-row performance fixture if that acceptance criterion remains. The prior Feature 1 work used Playwright plus axe and recorded CI evidence (`context/archive/2026-11-20-add-job-details/plan.md:326-348`, `context/archive/2026-11-20-add-job-details/plan.md:463-468`).

## Verification performed

- `npm run test:coverage` passed on 2026-11-26: 85 test files and 738 tests passed.
- Overall coverage was 95.09% statements, 92.06% branches, 95.90% functions, and 95.77% lines, exceeding the requested 80% baseline.
- `lib/applications/**` was 99.23% statements, 97.48% branches, 98.03% functions, and 99.11% lines, exceeding the repository’s stricter 90% domain threshold (`vitest.config.mts:13-33`).
- This was read-only research; no application implementation or test files were changed.

## Code References

- `supabase/docs/nextjoblog-mvp-screens.html:3093-3715` — complete Feature 1 application list, empty, detail, rejected, delete, and not-found design templates.
- `supabase/docs/nextjoblog-mvp-screens.html:433-445` — mobile-first/container breakpoint behavior.
- `supabase/docs/nextjoblog-mvp-screens.html:1139-1317` — list search/filter, responsive row, and desktop grid rules.
- `supabase/docs/nextjoblog-mvp-screens.html:1349-1413` — responsive detail grid and definition-list visual rules.
- `supabase/docs/nextjoblog-mvp-screens.html:4067-4077` — design notes mapping screens to Stories 1.4, 1.11–1.13, 1.5–1.8.
- `supabase/docs/nextjoblog-supabase-schema-en.md:98-141` — application columns and indexes.
- `supabase/docs/nextjoblog-supabase-schema-en.md:155-215` — status history and conversation notes.
- `supabase/docs/nextjoblog-supabase-schema-en.md:219-290` — RLS policy pattern.
- `app/(protected)/applications/page.tsx:21-71` — protected list route and load-error handling.
- `app/(protected)/applications/_components/ApplicationList.tsx:14-37` — list/empty composition.
- `app/(protected)/applications/_components/ApplicationRow.tsx:10-29` — row structure and detail link.
- `app/(protected)/applications/[id]/page.tsx:21-55` — protected dynamic detail route.
- `app/(protected)/applications/[id]/_components/DefinitionList.tsx:5-23` — accessible empty-value behavior.
- `lib/applications/repository.ts:98-127` — list/detail Supabase readers.
- `lib/applications/types.ts:47-67` — current detail model boundary.
- `lib/applications/detail-view.ts:15-49` — pure detail view model.
- `components/ui/{PageHeader,Card,EmptyState,StatusBadge,Button}.tsx` — reusable visual primitives.
- `vitest.config.mts:13-33` — coverage gates.
- `__tests__/applications/{list,detail}.test.tsx` — current route/component behavior coverage.

## Architecture Insights

The best-fit implementation boundary is to keep Story 1.4 as a real-URL, server-rendered list/detail flow and add only the missing baseline behavior. Treat search/filter and the richer recruiter/history/notes/CV sidebar as explicit adjacent slices because the design includes them but the change story does not. If the product owner interprets “every saved field” literally against the schema, expand the detail reader/model first; otherwise document that Story 1.4 means the current application record plus Story 1.2 job details.

The existing project structure is aligned with Next.js guidance: route-local private components under `_components`, pure domain logic under `lib/applications`, shared primitives under `components/ui`, and server-side Supabase access in repository factories. Continue that shape and avoid a monolithic page or client-side global data store.

## Historical Context (from prior changes)

- `context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:19-24` established the application light-theme UI kit, protected route patterns, list baseline, and the distinction between base list and later search/filter stories.
- `context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:69-90` identified reusable `PageHeader`, `Card`, `SectionLabel`, `StatusBadge`, `EmptyState`, `ApplicationList`, and `ApplicationRow` patterns and recommended table-driven status labels plus Tailwind responsive variants.
- `context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:237-248` established the ≥80% global testing target, ≥90% application-domain target, route/component/e2e coverage, and axe-based accessibility testing.
- `context/archive/2026-11-20-add-job-details/research.md:17-25` recorded the post-Story-1.1 route/domain/UI/test state and explicitly noted that the detail page did not yet exist at that research point.
- `context/archive/2026-11-20-add-job-details/plan.md:274-310` defined the detail-page slice that became the current implementation: `ApplicationDetail`, `DefinitionList`, safe `PostingLink`, `notFound()` for malformed/missing IDs, and page/component tests.
- `context/archive/2026-11-20-add-job-details/plan.md:314-348` defined Playwright + axe and coverage verification for the detail route.

## Related Research

- `context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md`
- `context/archive/2026-11-20-add-job-details/research.md`
- `context/archive/2026-11-20-add-job-details/plan.md`
- `docs/applications.md:1-34`

## Follow-up Research 2026-11-26T13:43:57+01:00

### Question

Should Story 1.4 keep the current 50-row list cap or load up to 500 applications without pagination?

### Evidence

- Story 1.4 is explicit: the happy path says all applications are shown (`context/changes/view-application-list-and-details/change.md:17-23`), the non-functional criterion targets up to 500 applications within 2 seconds (`context/changes/view-application-list-and-details/change.md:42-45`), and pagination is explicitly out of scope through 500 rows (`context/changes/view-application-list-and-details/change.md:50-52`). A hard 50-row cap cannot satisfy either “all” or “up to 500”.
- The design repeats the same contract in its implementation note: “No pagination up to 500 rows; render within 2 s” (`supabase/docs/nextjoblog-mvp-screens.html:4067-4069`). This is stronger evidence than the current implementation because it is the source design for the story.
- The current cap is deliberately temporary, not a product requirement. `LIST_PAGE_SIZE` is documented as a hard cap “until search and paging exist (Story 1.11)” and is 50 (`lib/applications/limits.ts:3-4`). The repository applies it unconditionally after the two deterministic sort keys (`lib/applications/repository.ts:98-110`), and the page displays a “most recent applications” warning whenever the returned length reaches the cap (`app/(protected)/applications/page.tsx:56-65`). This behavior knowingly hides older applications from a page whose purpose is “all my applications”.
- The schema already has the relevant access path: `applications_user_applied_date_idx` covers `(user_id, applied_date)` (`supabase/migrations/20260902082510_create_tables.sql:57-59`; documented at `supabase/docs/nextjoblog-supabase-schema-en.md:138-140`). RLS restricts rows to the authenticated owner (`supabase/migrations/20260902082511_create_rls_policies.sql:9-11`). The query selects only seven list columns and orders by `applied_date` then `created_at` (`lib/applications/repository.ts:24-27`, `:100-107`), so this is a bounded summary query rather than a detail join.
- Supabase/PostgREST's configured maximum is not a blocker for 500: the local project sets `max_rows = 1000` (`supabase/config.toml:16-18`), and the installed PostgREST client documents a default project maximum of 1,000 rows and implements `.limit(rows)` as the request's `limit` parameter (`node_modules/@supabase/postgrest-js/src/PostgrestQueryBuilder.ts:121-125`, `node_modules/@supabase/postgrest-js/src/PostgrestTransformBuilder.ts:392-400`, `:492-501`). Therefore 500 is within the local API ceiling, while an explicit application limit still protects the endpoint from unbounded reads.
- The supposed Dashboard precedent is not an implemented performance convention. The current Dashboard only authenticates and renders a heading (`app/(protected)/dashboard/page.tsx:10-21`). The design index describes counts and follow-up lists for F5-S1 but contains no measured 2-second implementation rule (`supabase/docs/nextjoblog-mvp-screens.html:4060-4063`). The 2-second number is therefore a Story 1.4 acceptance target, not evidence that 50 is necessary.
- Existing tests encode the current implementation, not the intended story: they assert `.limit(LIST_PAGE_SIZE)` (`__tests__/lib/applications/repository.test.ts:131-135`) and the cap notice at exactly that size (`__tests__/applications/list.test.tsx:63-72`). These tests must change if the story contract changes; they are not independent justification for 50.
- Prior planning established that the list query should remain a summary-only query and that the list behavior was separate from later search/filter work (`context/archive/2026-11-20-add-job-details/plan.md:175-179`; `context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:237-248`). That supports changing the bounded list size without pulling search/filter into this story.

### Decision

Raise the bounded list limit to 500 for Story 1.4 and retain a boundary notice updated to say “500 most recent applications” when exactly 500 rows are returned. Keep an explicit named constant (for example, `APPLICATION_LIST_LIMIT = 500`) rather than removing the bound. This is the smallest change that makes the implementation conform to the story and design while retaining a payload-safety guard below Supabase's 1,000-row API ceiling.

Do not implement pagination or search/filter as part of this decision. Search/filter remains Stories 1.11–1.13; the base list can later reuse the same repository boundary and add server-side predicates before the 500-row limit. If a future product decision raises the supported history above 500, introduce pagination or another bounded retrieval strategy then rather than silently increasing this constant.

### Implementation and verification implications

1. Replace the current 50-row constant with a clearly named 500-row application-list limit in `lib/applications/limits.ts`; update the reader's `.limit(...)` call in `lib/applications/repository.ts:100-107`.
2. Revise the cap alert in `app/(protected)/applications/page.tsx:62-65` and its message so it names 500 rather than 50. Keeping the notice makes the hard boundary observable without changing the base list into pagination.
3. Update repository tests to assert the 500 bound and preserve the selected columns, ordering, and error mapping (`__tests__/lib/applications/repository.test.ts:117-145`). Update page tests to assert the revised 500-row boundary notice (`__tests__/applications/list.test.tsx:63-72`). Add a fixture with 501 source rows only if testing the repository boundary itself; the UI contract is “up to 500”.
4. Add a Playwright performance check using an authenticated fixture containing 500 lightweight applications. Measure navigation until the list landmark and last row are visible, with a 2-second assertion appropriate to the project’s CI variance. Also verify 375px and desktop layouts and keyboard traversal; 500 rows should not introduce a client-side hydration or accessibility regression. The current unit suite cannot prove this because it mocks the reader and does not measure a browser or Supabase request.
5. Validate the query against the local Supabase stack with 500 owned rows, confirming newest-first ordering and that RLS still excludes another user’s rows. The existing index and policy are sufficient starting points; only add an index after measuring a real query plan or a failing performance check.

### Residual caveat

The 2-second target is not currently backed by a baseline measurement, a dashboard implementation, or a performance-test convention. The recommendation still follows the explicit acceptance criteria, but the implementation plan should treat the 500-row Playwright/local-Supabase check as a release gate and record its measured result. If that check fails, the right response is to investigate rendering/query cost (and potentially adopt progressive rendering or pagination as a changed product decision), not to silently restore a 50-row cap that violates the story.

## Open Questions

- Should missing application records render a feature-specific application card with Back to applications/Go to Dashboard, or is the shared `app/not-found.tsx` acceptable? The design and current route behavior currently point to different UI layers.

## Follow-up Research 2026-11-26 — Meaning of “every saved field”

### Conclusion

For Story 1.4, define “every saved field” as every user-entered field in the Story 1.1/1.2 application form, plus the application’s current status:

`title`, `company`, `applied_date`, `location`, `posting_url`, `closing_date`, `work_format`, `contract_type`, `discipline`, `tech_stack`, `salary_info`, and `status`.

The detail contract may also carry `id` for routing, but must not expose `user_id`, `created_at`, or `updated_at` as user-facing application fields. This is the smallest coherent contract because it matches the current form, current TypeScript model, current repository select, and the two completed neighboring stories. Optional values remain `—`/hidden according to the existing detail behavior.

Do not expand Story 1.4 to load recruiter, rejection, history, notes, documents, or reminders. Those are persisted or modeled for other feature slices, and adding them would turn this gap-filling story into an aggregation of unfinished stories.

### Evidence and boundary matrix

| Data | Database/schema evidence | Story/design ownership | Recommendation for 1.4 |
| --- | --- | --- | --- |
| Core fields and job details | `applications` columns are the five required fields plus six optional fields (`supabase/docs/nextjoblog-supabase-schema-en.md:106-119`). | Story 1.1 defines the five core fields (`context/archive/2026-11-17-log-a-new-application-with-required-fields/change.md:12-47`); Story 1.2 defines the optional details and says they are shown on detail (`context/archive/2026-11-20-add-job-details/change.md:12-45`). | **Include.** These are the baseline “saved fields.” |
| Current status | `applications.status` is part of the application row and defaults to `applied` (`supabase/docs/nextjoblog-supabase-schema-en.md:127-128`); the current model and detail select already include it (`lib/applications/types.ts:58-67`, `lib/applications/repository.ts:24-27,114-127`). | Story 1.1 establishes the initial status; the list/detail design includes status in the hero and list (`supabase/docs/nextjoblog-mvp-screens.html:4069`, `supabase/docs/nextjoblog-mvp-screens.html:4075`). | **Include current value only.** Do not add status mutation or timeline behavior. |
| Recruiter | `recruiter_name` and `recruiter_contact` are nullable columns (`supabase/docs/nextjoblog-supabase-schema-en.md:121-123`; migration: `supabase/migrations/20260902082510_create_tables.sql:44-46`). | Explicitly Story 1.5 in the design mapping, including its validation rule (`supabase/docs/nextjoblog-mvp-screens.html:4075`). The visual detail template shows the section because it composes Stories 1.4–1.6 (`supabase/docs/nextjoblog-mvp-screens.html:3481-3492`). | **Exclude from 1.4.** Include when Story 1.5 is implemented, with its own reader/model/tests. |
| Rejection reason | Nullable `applications.rejection_reason`, retained after status changes (`supabase/docs/nextjoblog-supabase-schema-en.md:124-125`). | Story 1.7’s rejected detail is a separate design item and is explicitly blocked by F2-S1 (`supabase/docs/nextjoblog-mvp-screens.html:4077`). | **Exclude.** It also requires prior-status derivation from history, not just a field render. |
| Status history | Separate Feature 2 table; the schema calls it the status-change timeline (`supabase/docs/nextjoblog-supabase-schema-en.md:155-177`). A trigger creates the initial row for every application (`supabase/migrations/20261119100000_application_defaults_and_history_trigger.sql:5-23`). | The design places it in the composite detail sidebar, but Story 1.4’s out-of-scope section excludes Kanban/F2 and the mapping assigns the detail template to 1.4–1.6 (`supabase/docs/nextjoblog-mvp-screens.html:3493-3522`, `supabase/docs/nextjoblog-mvp-screens.html:4075`). | **Exclude.** Existing rows are a persistence invariant, not a requirement to build the Feature 2 read model here. |
| Conversation notes | Separate one-to-many `conversation_notes` table (`supabase/docs/nextjoblog-supabase-schema-en.md:202-215`). | The design assigns the notes composer to Story 1.6, including disabled-empty behavior and backdating (`supabase/docs/nextjoblog-mvp-screens.html:3463-3478`, `supabase/docs/nextjoblog-mvp-screens.html:4075`). | **Exclude.** Do not fetch or render notes until the note read/write contract is implemented. |
| CV/cover-letter documents | `applications` stores nullable document foreign keys with `on delete set null` (`supabase/docs/nextjoblog-supabase-schema-en.md:130-132`); documents themselves belong to Feature 4. | The design explicitly says CV/cover-letter linking is Feature 4 and is left off the add form (`supabase/docs/nextjoblog-mvp-screens.html:4072`); the sidebar is only a composite template (`supabase/docs/nextjoblog-mvp-screens.html:3523-3526`). | **Exclude.** IDs without a document reader/authorization-safe display contract are not a usable detail feature. |
| Reminders | Separate Feature 3 table, including dates, times, notes, and calendar IDs (`supabase/docs/nextjoblog-supabase-schema-en.md:179-200`). | Story 1.1 notes that applied date seeds future reminders, while Story 1.6 says adding a note must not restart them (`context/archive/2026-11-17-log-a-new-application-with-required-fields/change.md:27-29`; `supabase/docs/nextjoblog-mvp-screens.html:4075`). | **Exclude.** A reminder is related application data, not an application field, and the design detail does not present a reminders section. |

### Why the wording is misleading

The change text says “every saved field” without defining whether “field” means an `applications` table column, a form field, or all related records (`context/changes/view-application-list-and-details/change.md:28-30`). The design uses the same phrase for a composite screen whose navigation item is tagged Stories 1.4–1.6 (`supabase/docs/nextjoblog-mvp-screens.html:4075`), while the schema deliberately combines Feature 1, current status, and Feature 4 columns in one `applications` table (`supabase/docs/nextjoblog-supabase-schema-en.md:98-135`). Therefore the database table is not a safe story boundary.

The current implementation provides the strongest executable boundary: `ApplicationDetail` is exactly the required + optional form data plus status (`lib/applications/types.ts:47-67`), `DETAIL_COLUMNS` selects that same set (`lib/applications/repository.ts:24-27,114-127`), and `buildJobDetailRows()` owns the optional job-detail presentation (`lib/applications/detail-view.ts:15-49`). Extending this contract to recruiter/history/notes would require new ports, queries, view models, loading/error states, and tests—not merely rendering additional fields.

### Recommended story clarification

Replace the ambiguous acceptance criterion with:

> When the user opens an application, the detail page shows every field saved by Stories 1.1 and 1.2, plus its current status. Empty optional values are shown as `—` or omitted. Recruiter contact, conversation notes, status history, rejection feedback, reminders, and CV/cover-letter links are delivered by their owning stories/features.

This preserves traceability to the form and current code, keeps Story 1.4 implementable without inventing cross-feature APIs, and leaves the richer design template available for the later slices.
- If search/filter is deferred, should the list page omit the design controls entirely or render disabled placeholders? The design notes assign them to Stories 1.11–1.13, so omission is the cleaner scope boundary.

## Follow-up Research 2026-11-26T13:43:53+01:00

### Research question

Resolve not-found behavior by tracing Next.js conventions, the current global `app/not-found.tsx`, protected layout/auth behavior, route tests, the design's `scr-not-found` template, and prior implementation decisions. Recommend whether to alter the global not-found page, add a route-level not-found page, or use another pattern, including accessibility and security implications.

### Conclusion

Use both boundaries for their distinct responsibilities:

1. Add `app/(protected)/applications/[id]/not-found.tsx` for application-resource misses caused by `notFound()` in the detail route. It should render the Feature 1 application-specific card with the exact message “Application not found”, a primary “Back to applications” link to `/applications`, and a secondary “Go to Dashboard” link to `/dashboard`.
2. Change the existing root `app/not-found.tsx` to a generic application-wide 404. The current root component is already styled like the application-missing screen, but Next.js uses the root `app/not-found.tsx` for unmatched URLs across the app as well as caught `notFound()` errors (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:7-15,166-168`). Keeping application-specific copy at the root would incorrectly tell users that `/settings/typo` or another unrelated URL is an application miss.

Do not use `global-not-found.tsx`: the project has one root layout and no need for the experimental routing-level convention. A route-level boundary preserves the protected shell and shared styles; a root `not-found.tsx` remains the fallback for URLs that do not enter the applications detail segment.

### Framework and route-segment behavior

- Next.js defines `not-found.tsx` as the UI rendered when `notFound()` is thrown in a route segment, and places it in the component hierarchy below the layout and above the page (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:7-15`; `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:91-111`). A `not-found.tsx` colocated with `[id]/page.tsx` is therefore the narrowest correct boundary for malformed, deleted, or RLS-hidden application IDs.
- `notFound()` terminates rendering by throwing the framework's 404 fallback error and adds `noindex` metadata (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md:6-15`). The current page calls it in the render path after awaiting `params`, which follows the framework requirement (`app/(protected)/applications/[id]/page.tsx:21-29,45`). Do not wrap these calls in a catch block; the Next.js docs warn that catching the thrown sentinel prevents the not-found UI (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md:30-33`).
- `global-not-found.tsx` is experimental, bypasses layouts, requires a complete HTML document and its own styles/fonts, and is intended mainly for multiple root layouts or top-level dynamic segments (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:17-61`). None of those conditions exists here (`app/layout.tsx:24-35`), so adopting it would add complexity without improving this flow.

### Auth and protected-layout interaction

- The application detail route verifies the session before validating the ID or querying Supabase (`app/(protected)/applications/[id]/page.tsx:21-32`). A verification failure returns `SessionCheckFailed` and never reaches `notFound()` or the repository (`app/(protected)/applications/[id]/page.tsx:22-25`; `__tests__/applications/detail.test.tsx:70-74`). Preserve this ordering.
- The route is nested under `app/(protected)/layout.tsx`, which wraps authenticated content in `ProtectedAppShell` and otherwise renders a minimal light-theme wrapper (`app/(protected)/layout.tsx:33-55`). A route-level `[id]/not-found.tsx` will therefore stay in the protected application layout, matching the design's side navigation/topbar composition. Reuse `PageHeader`, `Card`/`EmptyState`, and the existing path constants rather than reproducing the shell (`components/ui/PageHeader.tsx`, `components/ui/Card.tsx`, `components/ui/EmptyState.tsx`, `lib/applications/paths.ts:1-3`).
- The current root not-found screen is not generic: its heading is `Application`, its copy is “We can't find this application”, and both links point to `/dashboard` (`app/not-found.tsx:5-45`). This explains why the current test asserts two Dashboard links (`__tests__/not-found.test.tsx:7-14`), but it does not satisfy the design's application-specific back-to-list action.

### Design and exact acceptance mapping

- The `scr-not-found` template has the Applications side-nav context, topbar title `Application`, search icon, “Application not found”, the deleted-or-wrong-link explanation, “Back to applications”, and “Go to Dashboard” (`supabase/docs/nextjoblog-mvp-screens.html:3695-3715`). The design index explicitly maps it to Story 1.4 error handling and also to Story 0.4 (`supabase/docs/nextjoblog-mvp-screens.html:4079`).
- The story requires “Application not found” and a button back to the list (`context/changes/view-application-list-and-details/change.md:38-41`). Therefore the route-level boundary is required; changing only the root page would leave the global fallback semantically wrong and would not establish a reusable segment-specific contract.
- The prior detail plan already chose `notFound()` for malformed, missing, and foreign IDs and required manual verification for a random UUID and another user's ID (`context/archive/2026-11-20-add-job-details/plan.md:80-81,292,305,310`). The follow-up does not change that data-flow decision; it completes the UI boundary that the plan left at the shared root.

### Accessibility requirements

- Use a semantic `main` landmark with one page-level `h1`/heading, a short explanatory paragraph, and native `Link` elements for both recovery actions. The current root uses a `main`, heading hierarchy, and keyboard-visible `focus-visible` rings (`app/not-found.tsx:7-18,29-39`); preserve those strengths in the extracted/route-local version.
- “Back to applications” and “Go to Dashboard” must be visible link text, not icon-only controls. Give the topbar back control an accessible name if retained, and ensure it points to `/applications`; the design's icon-only mobile back button is labelled “Back” (`supabase/docs/nextjoblog-mvp-screens.html:3699-3701`).
- Keep touch targets at least the app's established 44px minimum (`app/not-found.tsx:12,36`; prior a11y decision `context/archive/2026-11-20-add-job-details/plan.md:14`). Maintain a visible keyboard focus indicator and sufficient text/control contrast against the light background.
- Do not use `role="alert"` for a stable 404 page; it is not an asynchronous error announcement. Use normal heading/paragraph semantics. A test should assert `getByRole("heading", { name: "Application not found" })`, both named links, and their exact hrefs.

### Security and privacy requirements

- Keep the same user-facing message for malformed IDs, deleted records, and another user's records. The route validates UUID shape before any query (`app/(protected)/applications/[id]/page.tsx:27-29`), and Supabase/RLS-backed reads return no detail for a missing or foreign application (`lib/applications/repository.ts:114-127`; schema RLS `supabase/docs/nextjoblog-supabase-schema-en.md:219-221`). This avoids an existence oracle.
- Do not include the requested ID, database error, owner ID, or provider response in the 404 UI. The current load-error path logs only a safe code and gives generic copy (`app/(protected)/applications/[id]/page.tsx:30-41`; `__tests__/applications/detail.test.tsx:57-62`). Not-found copy should be equally generic.
- Keep the boundary server-rendered and free of client-side URL parsing or data fetching. It needs no Supabase call, no user-controlled interpolation, and no redirect based on the untrusted ID. The fixed internal links to `/applications` and `/dashboard` avoid open-redirect risk.
- Next.js adds `noindex` for `notFound()` responses (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md:6-15`), which is appropriate for private application records. Do not replace the framework boundary with a normal rendered “empty state” that could return a successful page response and lose this signal.

### Test changes required

- Add a route-level component test for `[id]/not-found.tsx` covering the exact heading, explanatory text, `/applications` link, `/dashboard` link, landmarks, and keyboard-visible classes/attributes as appropriate.
- Update `__tests__/applications/detail.test.tsx:51-55` only if route tests are expanded to render the boundary; retain the existing assertions that malformed and missing IDs call the framework `notFound()` sentinel. Add a test proving `requireSession()` failure does not call the reader (`__tests__/applications/detail.test.tsx:70-74` already covers this invariant).
- Update `__tests__/not-found.test.tsx` after making the root generic. Its current expectations are coupled to application copy and two Dashboard links (`__tests__/not-found.test.tsx:7-14`); replace them with generic 404 semantics and one safe recovery link. Keep an integration/E2E assertion that `/applications/<random-uuid>` shows the application-specific boundary and that an unrelated unknown URL shows the generic root boundary.
- This is a small UI-only addition and should remain comfortably above the repository's global 80% and `lib/applications/**` 90% coverage gates (`vitest.config.mts:13-33`). The relevant historical plan also requires Playwright plus axe coverage for the detail/not-found route (`context/archive/2026-11-20-add-job-details/plan.md:314-328`).

### Recommended implementation shape

Create a route-local `not-found.tsx` alongside `[id]/page.tsx`, using existing UI primitives and `APPLICATIONS_PATH`; centralize user-facing copy in `lib/applications/messages.ts` if the same strings are asserted or reused by E2E. Then simplify `app/not-found.tsx` to a generic 404 fallback. Keep the detail page's current `requireSession()` → UUID validation → repository read → `notFound()` ordering unchanged. This is the least surprising Next.js structure, preserves the security invariant, and exactly matches `scr-not-found` without making the global boundary application-specific.

## Follow-up Research 2026-11-26 — Search/filter scope resolution

### Decision

Omit search and status-filter controls from the Story 1.4 implementation and stage them as a single follow-up change covering Stories 1.11, 1.12, and 1.13. Do not render disabled placeholders.

### Evidence and scope boundary

- Story 1.4 acceptance criteria require the complete base list/detail flow, newest-first ordering, empty state, optional-value handling, and not-found behavior; they do not mention search, filtering, query persistence, or result announcements (`context/changes/view-application-list-and-details/change.md:17-44`). Its only explicit out-of-scope items are Kanban and pagination (`context/changes/view-application-list-and-details/change.md:46-48`), so the story text does not authorize the adjacent controls by implication.
- The design deliberately maps the list screen to four stories, not one: 1.4 is the baseline row/list behavior, 1.11 adds search, 1.12 adds a single status filter, and 1.13 persists both values in `?q=...&status=...` (`supabase/docs/nextjoblog-mvp-screens.html:4069`). The no-match state is also tagged 1.11–1.13 (`supabase/docs/nextjoblog-mvp-screens.html:4071`).
- The design describes search/filter as a combined contract: case-insensitive company/title search, AND semantics with one status, URL restoration after returning from detail, “Clear all,” and a live result count (`supabase/docs/nextjoblog-mvp-screens.html:4069`). Implementing only the visible chips or only client-side filtering would create a screen that looks complete while failing the associated story behavior.
- The current list is a server-rendered route with no query-state boundary: `ApplicationsPage` takes no `searchParams`, and it calls the zero-argument `ApplicationReader.list()` (`app/(protected)/applications/page.tsx:27-42`; `lib/applications/ports.ts:13-16`). `ApplicationList` assumes the supplied array is the final result and only distinguishes zero total rows from non-zero rows (`app/(protected)/applications/_components/ApplicationList.tsx:14-39`). Adding controls without changing those boundaries would either filter the wrong dataset in the browser or require a monolithic client wrapper.
- The existing URL helper only builds the canonical detail path and has no list-query codec (`lib/applications/paths.ts:1-3`). The detail page's back link is always `/applications`, so it cannot restore search/filter state today (`app/(protected)/applications/[id]/page.tsx:37-49`). The existing auth redirect utility proves that preserving an internal path plus query is an established safe pattern, but it is not application-list-specific (`lib/auth/next-path.ts:16-53`; `lib/auth/login-redirect.ts:10-17`).
- Prior application research already treated the richer list as a later story and explicitly warned that raw user text must not be interpolated into a PostgREST `.or(...)` filter expression (`context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:21-23,226-227`). The current limits comment also describes the 50-row cap as temporary “until search and paging exist (Story 1.11)” (`lib/applications/limits.ts:3-4`).
- The prior optional-job-details plan explicitly excluded searching/filtering by the new fields (`context/archive/2026-11-20-add-job-details/plan.md:44-50`). This reinforces that list filtering is a separate domain boundary, not incidental work attached to every application change.

### Recommendation for the staged 1.11–1.13 change

Implement all three stories together as a URL-driven, server-side query slice:

1. Add a pure `ApplicationListQuery` parser/normalizer under `lib/applications/` for `q` and the allow-listed `ApplicationStatus` values. Unknown status, blank query, excessive query length, and unsupported parameters should normalize deterministically rather than reach Supabase. Keep the parser independent of `next/navigation` so it is unit-testable.
2. Extend the reader port to accept the normalized query object, while keeping the existing no-query call valid only if the base story still needs it. The repository must apply search/status predicates before the row limit, then retain `applied_date desc` and `created_at desc` ordering (`lib/applications/repository.ts:98-110`). Search must cover title OR company, and status must combine with it using AND, as specified by the design (`supabase/docs/nextjoblog-mvp-screens.html:4069`).
3. Pass the page's awaited `searchParams` into that parser and reader. Next 16 already uses the promise-based `searchParams` convention in the login route (`app/login/page.tsx:14-20`), so the applications route should follow that pattern rather than introducing a client-side global store.
4. Add a small query URL helper that serializes only non-default values and constructs detail/back links with the current query. This is needed because the current `applicationDetailPath(id)` and `PageHeader.backHref` APIs carry no list context (`lib/applications/paths.ts:1-3`; `components/ui/PageHeader.tsx:7-24`). Prefer explicit props/query values over relying on browser history, so bookmarked detail links and keyboard navigation remain deterministic.
5. Make the UI states explicit: labelled search textbox, single-select status radio group, `role="status"` result count, named clear actions, and distinct total-empty versus filtered-empty messages. The design requires these semantics and the filtered-empty copy (`supabase/docs/nextjoblog-mvp-screens.html:3115-3128,3209-3237`). Do not add disabled controls to Story 1.4: they add tab stops and imply functionality that the route does not provide, while failing the URL/result-state contract.

### SOLID, test, and performance implications

- Single responsibility: keep query parsing/serialization pure, repository filtering in the data-access adapter, and control rendering in a route-local component. Do not add query parsing, Supabase predicates, and empty-state branching to `ApplicationsPage` or `ApplicationList`.
- Dependency inversion/testability: inject a reader accepting `ApplicationListQuery`; unit-test the parser and serializer as table-driven pure functions, repository tests for predicate/order/limit calls, and route tests for query propagation. The current test seam already mocks the reader factory (`__tests__/applications/list.test.tsx:4-24`).
- Security: never pass raw `q` into a composed PostgREST filter string. Escape the pattern and delimiters in a dedicated adapter/helper, or use a parameterized database-side mechanism; preserve the prior rule against raw `.or(...)` interpolation (`context/archive/2026-11-17-log-a-new-application-with-required-fields/research.md:226-227`). Add malicious delimiter, wildcard, Unicode, whitespace, and over-limit query cases.
- Performance: filtering must happen before limiting, otherwise the current 50-row cap can hide valid matches (`lib/applications/repository.ts:101-107`). The baseline story's 500-row/no-pagination statement is in the design (`supabase/docs/nextjoblog-mvp-screens.html:4069`), but the code currently caps at 50 (`lib/applications/limits.ts:3-4`). Resolve that cap separately in the 1.4 plan or revise the acceptance criterion; do not use search/filter as an excuse for silently changing it.
- Coverage: preserve the repository's 80% global and 90% `lib/applications/**` gates (`vitest.config.mts:13-33`). The staged change should add unit coverage for every query-state branch, component coverage for keyboard/radio/live-region/clear behavior, route coverage for URL round trips, and an E2E fixture that proves a matching row beyond the first page is returned. This is materially more test surface than Story 1.4 and supports staging it cleanly.

### Final scope recommendation

For the current change: implement the baseline list with no search box, status chips, result line, or filtered-empty copy. Keep the existing reusable list primitives and empty state unchanged. Create a follow-up plan for 1.11–1.13 as one cohesive URL/server-query change; do not split the controls across unrelated changes because their AND semantics, URL persistence, clear behavior, and accessibility announcements are coupled.

## Follow-up Research 2026-11-26T13:40:00+01:00

### Resolved decisions

1. **Use a bounded 500-row list for Story 1.4.** The acceptance criterion and the design implementation note both explicitly require up to 500 applications without pagination and a render target of two seconds (`context/changes/view-application-list-and-details/change.md:23-25`; `supabase/docs/nextjoblog-mvp-screens.html:4067-4071`). The current `LIST_PAGE_SIZE = 50` was a temporary safety cap documented as lasting “until search and paging arrive in Story 1.11” (`lib/applications/limits.ts:3-5`; `context/archive/2026-11-17-log-a-new-application-with-required-fields/plan.md:430-431`). Since pagination is explicitly out of scope, retaining 50 would fail the current story rather than merely defer an optimization.

   Recommendation: raise the named safety bound to 500, keep the existing `applied_date DESC` then `created_at DESC` ordering, and retain the capped-list alert for the exact-boundary case. Do not remove the bound or fetch an unbounded table. The existing owner/applied-date index supports the primary order (`supabase/docs/nextjoblog-supabase-schema-en.md:138-141`), while the summary projection intentionally selects only list fields (`lib/applications/repository.ts:24-27`, `lib/applications/repository.ts:98-111`). Add a 500-row fixture/performance assertion to E2E; the current unit test only proves the configured cap (`__tests__/applications/list.test.tsx:63-72`).

2. **Define “every saved field” as every field in the Story 1.4 application-detail contract, not every related Feature 1/2/4 record.** The design labels the base detail screen as Stories 1.4–1.6 and separately assigns rejected feedback to 1.7; its detail screen also visually includes recruiter/contact, notes, status history, and CV links (`supabase/docs/nextjoblog-mvp-screens.html:4075-4079`). The database is broader still: `applications` owns recruiter, rejection, and document foreign-key columns, while notes/history/reminders are separate tables (`supabase/docs/nextjoblog-supabase-schema-en.md:98-215`). Implementing all of those here would silently absorb Stories 1.5–1.7 and Feature 2/4 work.

   Recommendation: make the Story 1.4 contract explicit as the required fields, six optional job-detail fields, and current status—the fields currently represented by `ApplicationDetail`, `DETAIL_COLUMNS`, `ApplicationHero`, and `JobDetailsCard` (`lib/applications/types.ts:16-67`; `lib/applications/repository.ts:24-27`; `app/(protected)/applications/[id]/page.tsx:47-53`). Keep recruiter/notes/rejection/history/document rendering in their owning stories, but add a planning note that the phrase “every saved field” must be narrowed before implementation. If the product owner instead means every column already persisted on `applications`, that is a separate expansion requiring new types, reader columns, view models, tests, and UI—not a component-only change.

3. **Add a route-local not-found screen; do not change the global fallback.** The route guard documentation requires missing and non-owned rows to produce the same generic response to avoid existence disclosure (`docs/route-guard.md:3-7`). The current detail page already validates UUIDs and calls `notFound()` for malformed or invisible records (`app/(protected)/applications/[id]/page.tsx:27-45`). Next supports a `not-found.tsx` file at the route segment boundary for this purpose (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:6-15`).

   Recommendation: add `app/(protected)/applications/[id]/not-found.tsx` and render the design’s generic “Application not found” message with both Back to applications and Go to Dashboard actions (`supabase/docs/nextjoblog-mvp-screens.html:3695-3715`). Keep the global `app/not-found.tsx` unchanged because it is already covered as a shared fallback (`app/not-found.tsx:5-45`; `__tests__/not-found.test.tsx:7-14`). Test malformed, deleted, and foreign IDs through the same route-local UI, asserting that the wording does not reveal which case occurred.

4. **Omit search/filter controls from this implementation; do not render disabled placeholders.** The design assigns search to 1.11, status filtering to 1.12, and URL persistence/combined filtering to 1.13 (`supabase/docs/nextjoblog-mvp-screens.html:4067-4071`). Prior implementation planning explicitly excluded search/status filtering and filtered-empty state from the base application story (`context/archive/2026-11-17-log-a-new-application-with-required-fields/plan.md:44-46`). The current repository reader has no query object and the current page has no `searchParams` contract (`lib/applications/ports.ts:13-21`; `app/(protected)/applications/page.tsx:27-69`).

   Recommendation: implement the Story 1.4 list with the existing `PageHeader`, Add application action, semantic list, and first-use empty state only. Do not add inert search/filter controls: they would create misleading affordances and extra accessibility states. When 1.11–1.13 begins, parse URL state in the server page, pass a typed filter object through the reader port, apply filters before the 500-row limit, and add pure URL/query parsing tests plus result-status a11y coverage. The existing list composition remains reusable without modification (`app/(protected)/applications/_components/ApplicationList.tsx:14-37`).

### Follow-up implementation/test consequences

- Update the list bound and its message/test expectations together; verify a 500-row authenticated fixture completes within two seconds at desktop and mobile widths.
- Keep the base detail reader and view model focused on the current Story 1.4 contract; do not join child tables until their owning stories define write/read semantics.
- Add the route-local not-found component and route tests for malformed, missing, and foreign IDs, plus an axe check for both recovery links.
- Leave search/filter absent, then implement it as a separate change with URL state, server-side filtering before the limit, safe pattern escaping, debouncing only where a client control is introduced, and `role="status"` result announcements.

These decisions leave no unresolved research question for the current Story 1.4 scope. The only product clarification still worth recording before planning is whether the stakeholder accepts the narrowed definition of “every saved field”; if not, the change scope must be expanded explicitly.

## Follow-up Research 2026-11-26T13:43:31+01:00

### Research question

Resolve not-found behavior for `/applications/[id]`: trace Next.js conventions, the current global fallback, protected layout/auth behavior, route tests, the `scr-not-found` design template, and prior implementation decisions. Recommend whether to alter the global fallback, add a route-level fallback, or use another pattern, including accessibility and security implications.

This follow-up supersedes the earlier provisional recommendation in the preceding follow-up section to leave `app/not-found.tsx` unchanged. The direct read of the current Next.js convention shows that the root fallback also serves unmatched URLs, so the existing application-specific root copy has a broader correctness problem.

### Findings

1. **The existing control flow is correct and should remain.** The detail page authenticates first, returns the verification-failed screen without querying, validates the UUID, reads through the application repository, and calls `notFound()` for malformed or missing/foreign IDs (`app/(protected)/applications/[id]/page.tsx:21-45`). Next.js documents `notFound()` as the route-segment mechanism that renders the nearest `not-found.tsx` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:6-15`); its example uses `app/blog/[slug]/not-found.tsx` for a dynamic route (`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md:149-193`).

2. **The current root fallback has the wrong responsibility.** `app/not-found.tsx:5-43` renders an `Application` heading, says “We can't find this application”, and links only to `/dashboard`. Next.js says the root `app/not-found.tsx` also handles unmatched URLs across the application (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:127-133`). Therefore `/typo`, an unknown public route, and an application record that calls `notFound()` can all receive application-specific copy. That is semantically wrong and creates a maintenance trap as more route-specific 404 states are added.

3. **The design explicitly requires an application-scoped fallback.** `scr-not-found` is an Applications screen with the protected side navigation, `Application` topbar, “Application not found” heading, the deleted-or-wrong-link explanation, a primary “Back to applications” action, and a secondary “Go to Dashboard” action (`supabase/docs/nextjoblog-mvp-screens.html:3695-3715`). The screen index also states that this covers a deleted record or someone else's record and intentionally uses the same message (`supabase/docs/nextjoblog-mvp-screens.html:4079`).

4. **The protected layout can own the application fallback shell.** The applications detail route is under `app/(protected)/layout.tsx`; the route group does not change the URL, and layouts at any level wrap descendant segments (`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:69-99`). The protected layout checks session state and wraps authenticated content in `ProtectedAppShell` (`app/(protected)/layout.tsx:33-55`). A nested `app/(protected)/applications/[id]/not-found.tsx` is consequently the correct place for the design-specific UI: it remains inside the root layout and protected route hierarchy, while the root fallback remains suitable for unrelated unmatched URLs.

5. **Authentication and data isolation are not bypassed by the fallback.** `requireSession()` redirects unauthenticated users and returns a verification-failed state for session lookup failures (`lib/auth/require-session.ts:30-51`); the detail page handles that before reading the repository (`app/(protected)/applications/[id]/page.tsx:21-25`). The detail reader returns no visible row for a missing or RLS-hidden record, and the page maps both cases to the same `notFound()` branch (`app/(protected)/applications/[id]/page.tsx:30-45`; `__tests__/applications/detail.test.tsx:51-55`). The application-specific copy must not include the requested UUID, user ID, database error, or a distinction between “deleted” and “someone else's”; the design's single message is the correct anti-enumeration behavior.

6. **The global-not-found convention is not needed.** Next.js describes `app/global-not-found.tsx` as an experimental routing-level page that bypasses layouts and requires its own full HTML document, styles, fonts, and theme (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:47-60`, `:74-125`). This repository has one root layout and does not need a layout-independent unmatched-route implementation. Enabling it would add configuration and duplicate styling without solving the application-record case, which is generated by `notFound()` inside an existing route segment.

### Recommendation

Use both layers with distinct responsibilities:

- Add `app/(protected)/applications/[id]/not-found.tsx` for the exact `scr-not-found` state. Use `/applications` as the primary CTA and `/dashboard` as the secondary CTA. Reuse existing `Card`, button/link focus styles, and application message/path constants where practical; keep the component server-rendered and prop-free, matching the Next.js convention.
- Replace `app/not-found.tsx` with a generic application-wide 404 that does not claim the missing resource is an application. It may offer a safe link to `/` or another public entry point; it must not assume an authenticated user or protected shell.
- Do not add `app/global-not-found.tsx` or change `next.config.ts`.

This is preferable to changing only the global fallback because it satisfies the design and prevents unrelated routes from inheriting application language. It is preferable to a custom conditional fallback based on pathname because the App Router already provides route-segment selection, and pathname inspection would couple one component to multiple route contracts.

### Accessibility implications

- Render one clear page heading for the state, preferably `h1` “Application not found”; the protected `PageHeader`/topbar should not create a competing heading hierarchy.
- Use real `Link` elements for both recovery actions, with visible `:focus-visible` indicators and at least the existing `min-h-11` touch target pattern used elsewhere (`app/not-found.tsx:10-16`, `:28-36`).
- Keep the search icon decorative with `aria-hidden="true"`; do not use it as the only signal of failure.
- Preserve sufficient text contrast for the muted explanatory copy and ensure the primary/secondary actions remain distinguishable without color alone.
- Add component assertions for heading, exact action names/hrefs, and keyboard-focusable links. Add an axe check for the populated, empty, and application-not-found states as already required by the prior detail plan (`context/archive/2026-11-20-add-job-details/plan.md:314-352`).

### Security implications

- Keep the current order: authenticate/verify, then query, then call `notFound()`; never query before the guard (`app/(protected)/applications/[id]/page.tsx:21-32`).
- Keep one identical message for malformed UUIDs, deleted rows, and rows hidden by RLS. Do not echo the ID or provider errors. Existing safe logging already records only a code for load failures (`app/(protected)/applications/[id]/page.tsx:30-41`; `__tests__/applications/detail.test.tsx:57-62`).
- Use fixed internal href constants (`APPLICATIONS_PATH`, `DEFAULT_POST_LOGIN_PATH`/dashboard path), not a query-string or request-derived redirect target. This avoids introducing an open redirect into a recovery screen.
- Do not make the root generic 404 protected or session-aware; unmatched public URLs must not leak authentication state or force an auth lookup.

### Exact implementation/test impact

- New route component: `app/(protected)/applications/[id]/not-found.tsx`.
- Correct existing fallback: `app/not-found.tsx` becomes generic; update `__tests__/not-found.test.tsx` so it asserts generic copy and no application-specific claim.
- Add a focused route-fallback component test for “Application not found”, `/applications`, and `/dashboard`.
- Retain the existing detail-page tests that assert malformed and missing IDs throw the framework sentinel (`__tests__/applications/detail.test.tsx:51-55`); add an integration/E2E assertion that a random UUID and another user's UUID render the application fallback and expose neither UUID nor ownership information.
- Run `npm run test:coverage`; the repository gate remains at least 80% globally and 90% for `lib/applications/**` (`vitest.config.mts:13-33`). No new domain logic is needed, so this change should not threaten the stricter application-domain threshold.

### Decision

**Add a route-level `not-found.tsx` under `/applications/[id]`, make the root `app/not-found.tsx` generic, and leave `global-not-found` disabled.** This directly matches Next.js segment conventions, the `scr-not-found` design, the protected auth boundary, and the existing anti-enumeration behavior.

## Follow-up Synthesis 2026-11-26

The parallel follow-up reviews converge on these final decisions; this section supersedes earlier provisional wording where sections disagree:

- **List capacity:** rename `LIST_PAGE_SIZE` to `MAX_APPLICATION_LIST_ROWS` and set it to 500. Keep the bound, ordering, summary projection, and boundary alert. Validate the two-second requirement with a seeded 500-row E2E/performance fixture; the current dashboard is not a benchmark (`lib/applications/limits.ts:3-5`; `lib/applications/repository.ts:98-111`; `app/(protected)/dashboard/page.tsx:10-20`).
- **Detail contract:** define “every saved field” as the five Story 1.1 fields, six Story 1.2 optional fields, and current status. Exclude recruiter, notes, rejection feedback, status history, reminders, and CV/cover-letter links until their owning stories define their read/write contracts (`lib/applications/types.ts:16-67`; `supabase/docs/nextjoblog-mvp-screens.html:4075-4079`). The acceptance criterion should be clarified before planning.
- **Not found:** add `app/(protected)/applications/[id]/not-found.tsx` with “Application not found”, `/applications`, and `/dashboard` recovery links. Make the root `app/not-found.tsx` generic because it also handles unrelated unmatched routes. Preserve authenticate → UUID validation → repository read → `notFound()` and identical copy for malformed, deleted, and foreign IDs (`docs/route-guard.md:3-7`; `app/(protected)/applications/[id]/page.tsx:21-45`).
- **Search/filter:** omit controls and disabled placeholders from Story 1.4. Stage Stories 1.11–1.13 as one URL-driven server-side filtering change, with pure query parsing, allow-listed statuses, safe search escaping, filtering before the 500-row limit, URL-preserved detail navigation, and live-region/a11y tests (`supabase/docs/nextjoblog-mvp-screens.html:4069`; `context/archive/2026-11-17-log-a-new-application-with-required-fields/plan.md:44-46`).

No implementation files were changed during this follow-up research. Delegated agents were used where session capacity allowed; the final synthesis was checked against the live repository sources after several completed-agent threads temporarily exhausted the delegation limit.
