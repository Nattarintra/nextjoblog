# View Application List and Details Implementation Plan

## Overview

Complete Story 1.4's authenticated application list and detail experience. The implementation will preserve the existing server-rendered and dependency-injected architecture, expose up to 500 applications in newest-first order, refine the responsive list presentation, and provide correct application-specific not-found behavior.

The detail contract is intentionally limited to the five Story 1.1 required fields, six Story 1.2 optional job-detail fields, and current status. Recruiter data, notes, history, rejection feedback, reminders, and documents remain with their owning stories.

## Current State Analysis

The protected `/applications` and `/applications/[id]` routes already load through reader ports and the cookie-bound Supabase client. Existing UI primitives cover the page header, cards, empty state, status badge, chips, definition lists, safe posting links, and optional-value accessibility.

The main gaps are the temporary 50-row repository cap, list rows that combine desktop columns, the application-specific not-found screen, and missing CI verification for 500-row rendering/performance. The current root not-found page is application-specific even though it also handles unrelated unmatched routes.

## Desired End State

An authenticated user can open `/applications`, see all visible applications up to the explicit 500-row safety bound sorted by `applied_date DESC` and `created_at DESC`, and open any row to view the complete Story 1.4 detail contract. Empty optional values render as `—` with an accessible “Not provided” label.

Malformed, deleted, and foreign application IDs produce the same route-local “Application not found” state with links to Applications and Dashboard. Unrelated unmatched URLs use a generic root 404. Unit/component coverage remains above repository thresholds, and CI E2E verifies RLS, accessibility, responsive behavior, and the 500-row/timing requirement.

### Key Discoveries:

- `ApplicationReader`, `ApplicationDetailReader`, and the repository adapter already provide the correct dependency-inversion seam (`lib/applications/ports.ts`, `lib/applications/repository.ts:98-127`).
- `ApplicationList`, `ApplicationRow`, `ApplicationHero`, `JobDetailsCard`, `DefinitionList`, and existing UI primitives are reusable (`app/(protected)/applications/_components/`, `app/(protected)/applications/[id]/_components/`, `components/ui/`).
- The current `LIST_PAGE_SIZE = 50` conflicts with the story/design requirement for up to 500 rows (`lib/applications/limits.ts:3-4`, design `supabase/docs/nextjoblog-mvp-screens.html:4067-4071`).
- Supabase RLS already hides foreign application rows; the detail route must preserve authenticate → UUID validation → repository read → `notFound()` ordering.
- Search/filter, board, recruiter, notes, status history, rejection, reminders, and document links are later-story scope.

## What We're NOT Doing

- Search, status filtering, URL query persistence, filtered-empty states, or result-count announcements (Stories 1.11–1.13).
- Kanban/board view, edit, delete, recruiter contact, conversation notes, rejection feedback, status history, reminders, or CV/cover-letter rendering.
- New database tables, migrations, or a composite index unless CI evidence demonstrates the existing indexed query is insufficient for 500 rows.
- Local E2E execution; Playwright verification is specified for CI because local E2E is unavailable in the requested environment.

## Implementation Approach

Keep route pages responsible for session guards, loading, error mapping, and composition. Keep Supabase access behind the existing reader interfaces. Keep display and formatting rules in small application-domain helpers and keep UI responsibilities in composable route-private components and shared primitives.

Raise the named safety bound to 500 without removing the limit. Preserve the summary projection and deterministic ordering. Refine the existing semantic list into responsive desktop columns rather than replacing it with a native table, so keyboard navigation and current component reuse remain intact. Add the route-segment not-found boundary required by Next.js and make the root fallback generic.

## Critical Implementation Details

### User experience spec

The route-local not-found state must use the exact generic message “Application not found”, provide visible native links to `/applications` and `/dashboard`, and reveal no requested ID, owner, or provider error. The root fallback must not assume authentication or claim that the missing resource is an application.

### Performance constraints

The list remains explicitly bounded at 500 rows and must preserve the existing lightweight summary projection. CI should seed 500 rows and measure only the route load: start immediately before `page.goto('/applications')` for an already authenticated browser context, and stop after the applications list landmark and the 500th row are visible. Exclude Supabase startup, Next.js startup, fixture seeding, and authentication. Assert a maximum of 2,500 ms in CI as the documented 500 ms shared-runner tolerance, and report the raw measured duration separately from the assertion.

## Phase 1: Data Contract and List Capacity

### Overview

Align the application list bound, naming, cap messaging, repository contract, and unit tests with the approved 500-row Story 1.4 requirement.

### Changes Required:

#### 1. Named list bound and route usage

**Files**: `lib/applications/limits.ts`, `app/(protected)/applications/page.tsx`, `lib/applications/messages.ts`

**Intent**: Replace the temporary 50-row constant with a clearly named 500-row maximum and update the list route/cap message to use it consistently.

**Contract**: The reader applies an explicit maximum of 500; the UI announces the cap only when the returned list reaches that bound.

#### 2. Repository and port verification

**Files**: `lib/applications/repository.ts`, `lib/applications/ports.ts`

**Intent**: Preserve the reader boundary, list projection, owner scoping through the server Supabase client, and `applied_date`/`created_at` descending ordering while applying the new bound.

**Contract**: `ApplicationReader.list()` continues returning `ApplicationSummary[]`; no related tables or new fields are added to the Story 1.4 reader.

#### 3. Repository/list tests

**Files**: `__tests__/lib/applications/repository.test.ts`, `__tests__/applications/list.test.tsx`

**Intent**: Update expectations to the 500-row contract and retain coverage for selected columns, deterministic ordering, cap messaging, empty state, load errors, and session failures.

**Contract**: Tests must prove the repository calls `.limit(500)` and the route does not show a cap message below 500 rows.

### Success Criteria:

#### Automated Verification:

- Repository tests pass with the 500-row bound and unchanged projection/order.
- Application list component/page tests pass, including empty, load-error, session-failure, and exact-boundary cap states.
- `npm run test:coverage` remains above 80% globally and 90% for `lib/applications/**`.

#### Manual Verification:

- Confirm the populated list is newest-first and the cap message is understandable at exactly 500 rows.

## Phase 2: Responsive List and Detail Presentation

### Overview

Bring the baseline list/detail presentation closer to the approved Applications design while preserving semantic HTML, keyboard navigation, and existing reusable components.

### Changes Required:

#### 1. Responsive application rows

**Files**: `app/(protected)/applications/_components/ApplicationRow.tsx`, `app/(protected)/applications/_components/ApplicationList.tsx`, related component tests

**Intent**: Separate role/company, location, applied date, and status into responsive visual columns on desktop while retaining stacked metadata on mobile and a real keyboard-focusable detail link.

**Contract**: The list remains a labelled semantic `<ul>` of `<li>` rows; the detail destination remains `applicationDetailPath(id)` and posting URLs continue to be independently validated.

#### 2. Story 1.4 detail contract

**Files**: `app/(protected)/applications/[id]/page.tsx`, `ApplicationHero.tsx`, `JobDetailsCard.tsx`, `DefinitionList.tsx`, `lib/applications/detail-view.ts`, related tests

**Intent**: Ensure every field in the approved Story 1.4 contract is shown once, formatted consistently, and represented safely when optional values are null, empty, or an empty technology array.

**Contract**: Detail rendering remains based on `ApplicationDetail`, `DETAIL_COLUMNS`, and pure view-model helpers; no recruiter, notes, history, rejection, reminder, or document joins are introduced.

#### 3. Responsive/a11y component verification

**Files**: `__tests__/applications/list.test.tsx`, `__tests__/applications/detail.test.tsx`, new focused component tests as needed

**Intent**: Assert one page heading, semantic list structure, visible focusable navigation, safe external-link attributes, status presentation, and accessible optional-value fallbacks.

**Contract**: Native links/buttons, visible focus styles, semantic landmarks, and no null/blank-value output are required at both desktop and mobile layouts.

### Success Criteria:

#### Automated Verification:

- Component tests cover populated rows, all Story 1.4 fields, optional-value dashes, safe/unsafe posting links, and keyboard-reachable detail links.
- `npm run lint` and `npm run typecheck` pass.

#### Manual Verification:

- Review the list at desktop and 375px mobile widths for column/stack behavior and horizontal overflow.
- Keyboard-tab through list rows and detail actions; confirm visible focus and readable labels.

## Phase 3: Not-Found Boundaries and Error Behavior

### Overview

Implement the design-specific application not-found state without weakening Next.js 404 semantics, authentication ordering, or RLS privacy.

### Changes Required:

#### 1. Route-local application not-found UI

**File**: `app/(protected)/applications/[id]/not-found.tsx`

**Intent**: Add the nearest segment fallback for malformed, deleted, and RLS-hidden application records using existing card, link, focus, and message/path patterns.

**Contract**: Render “Application not found”, a concise generic explanation, a primary `/applications` link labelled “Back to applications”, and a secondary `/dashboard` link labelled “Go to Dashboard”.

#### 2. Generic root fallback

**File**: `app/not-found.tsx`

**Intent**: Remove application-specific language and protected assumptions from the application-wide unmatched-route fallback.

**Contract**: The root fallback remains safe for public and unrelated routes and does not expose application IDs, session state, or provider errors.

#### 3. Route and fallback tests

**Files**: `__tests__/applications/detail.test.tsx`, new route-local not-found test, `__tests__/not-found.test.tsx`

**Intent**: Preserve sentinel behavior and verify exact headings, recovery links, generic copy, and the invariant that failed session verification prevents repository access.

**Contract**: Malformed, deleted, and foreign IDs share the same user-facing application fallback; unrelated unknown routes use the generic root fallback.

### Success Criteria:

#### Automated Verification:

- Detail route tests pass for session failure, malformed UUID, missing row, load error, and successful detail rendering.
- Route-local not-found tests assert the exact heading and both recovery hrefs.
- Root not-found tests assert generic copy and no application-specific claim.

#### Manual Verification:

- Open a random application UUID and confirm the application-specific fallback has both recovery actions.
- Open an unrelated unknown route and confirm it uses generic 404 copy.
- Confirm no ID, owner information, or database error appears in either UI.

## Phase 4: Verification and CI E2E

### Overview

Extend browser-level verification for RLS isolation, responsive/a11y states, direct bookmarked detail routes, and the 500-row performance requirement. E2E runs in CI only.

### Changes Required:

#### 1. Applications E2E coverage

**File**: `e2e/applications.spec.ts`

**Intent**: Extend existing authenticated flows with explicit list/detail acceptance checks, route-local not-found assertions, keyboard/a11y checks, and desktop/mobile coverage.

**Contract**: E2E must verify a foreign/deleted detail URL produces the same not-found state, the list shows required summary values, and axe reports no violations for populated, empty, detail, and not-found states.

#### 2. Seeded 500-row performance case

**Files**: `e2e/helpers/supabase-admin.ts`, `e2e/applications.spec.ts`, supporting helper files only if required

**Intent**: Add an E2E fixture helper around the existing service-role client that creates an isolated confirmed user and returns its `{ id, email, password }`, batch-inserts 500 lightweight application rows owned by that user, and provides a deterministic detail ID for the foreign-user case. Authenticate through the existing application login helper, verify all 500 are available in the rendered list, and measure route completion.

**Contract**: The fixture must create the user with the existing admin auth API, insert rows with valid Story 1.1 required fields and deterministic applied/created timestamps, and delete the created auth user in a `finally` block so its application rows cascade. The test must use a separate authenticated user to verify the owner’s detail ID is not visible and produces the same application not-found state. For the performance assertion, start `performance.now()` immediately before `page.goto('/applications')` in the authenticated context and stop after the list landmark and the 500th row are visible; exclude setup/authentication and assert `duration <= 2500` ms while logging the raw duration.

#### 3. CI execution documentation

**Files**: `docs/` or existing CI documentation location, only if the repository has a suitable convention

**Intent**: Document that local E2E is intentionally unavailable for this task and identify the required Supabase, service-role, browser, and environment setup for CI.

**Contract**: The plan's E2E command remains `npm run test:e2e`; no local-only workaround or fake performance result is accepted.

### Success Criteria:

#### Automated Verification:

- `npm run test:coverage` passes all configured thresholds.
- `npm run lint` passes.
- `npm run typecheck` passes.
- CI `npm run test:e2e` passes with populated, empty, detail, RLS/not-found, responsive, axe, and 500-row timing coverage.

#### Manual Verification:

- Review CI artifacts for the measured 500-row duration and Playwright/axe results.
- Smoke-test list-to-detail navigation and recovery links on desktop and mobile after CI passes.

## Testing Strategy

### Unit Tests:

- 500-row constant and cap-message boundary.
- Repository projection, deterministic ordering, limit, empty result, malformed UUID, missing row, and sanitized error mapping.
- Pure date/detail formatting and optional-value normalization where changed.

### Integration/Component Tests:

- Authenticated list success, first-use empty state, load failure, session verification failure.
- Responsive row semantics, status/date/location separation, detail navigation, safe external URL policy.
- Detail fields, current status, null/empty optional values, and accessible “Not provided” output.
- Application-specific and generic not-found boundaries.

### CI E2E Tests:

- Add → detail → list → reopen flow.
- Foreign/deleted detail URL under RLS.
- Populated, empty, detail, and not-found axe checks.
- Desktop and 375px mobile navigation/landmark checks.
- Seeded 500-row list completeness and two-second-budget measurement.

## Performance Considerations

Use the existing summary projection and explicit 500-row limit. The current `(user_id, applied_date)` index supports the primary ordering; retain the `created_at` tie-breaker and validate the real route in CI before introducing an index migration.

## Migration Notes

No database migration is expected. Existing RLS policies, status-history triggers, and application schema remain unchanged. If CI demonstrates a material query-plan problem at 500 rows, stop and add a separately reviewed migration rather than silently changing the schema in this story.

## References

- Story: `context/changes/view-application-list-and-details/change.md`
- Research: `context/changes/view-application-list-and-details/research.md`
- Design: `supabase/docs/nextjoblog-mvp-screens.html:3093-3715`
- Schema: `supabase/docs/nextjoblog-supabase-schema-en.md:98-287`
- Next.js structure: `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
- Existing list route: `app/(protected)/applications/page.tsx`
- Existing detail route: `app/(protected)/applications/[id]/page.tsx`
- Existing repository: `lib/applications/repository.ts:98-127`
- Existing E2E: `e2e/applications.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Contract and List Capacity

#### Automated

- [x] 1.1 Repository tests pass with the 500-row bound and unchanged projection/order. — 8b419d6
- [x] 1.2 Application list/page tests pass, including empty, load-error, session-failure, and exact-boundary cap states. — 8b419d6
- [x] 1.3 `npm run test:coverage` remains above 80% globally and 90% for `lib/applications/**`. — 8b419d6

#### Manual

- [x] 1.4 Confirm the populated list is newest-first and the cap message is understandable at exactly 500 rows. — 8b419d6

### Phase 2: Responsive List and Detail Presentation

#### Automated

- [x] 2.1 Component tests cover populated rows, Story 1.4 fields, optional-value dashes, safe/unsafe posting links, and keyboard-reachable detail links. — 311cca3
- [x] 2.2 `npm run lint` and `npm run typecheck` pass. — 311cca3

#### Manual

- [x] 2.3 Review the list at desktop and 375px mobile widths for column/stack behavior and overflow. — 311cca3
- [x] 2.4 Keyboard-tab through list rows and detail actions; confirm visible focus and readable labels. — 311cca3

### Phase 3: Not-Found Boundaries and Error Behavior

#### Automated

- [x] 3.1 Detail route tests pass for session failure, malformed UUID, missing row, load error, and successful detail rendering. — 49dd034
- [x] 3.2 Route-local not-found tests assert the exact heading and both recovery hrefs. — 49dd034
- [x] 3.3 Root not-found tests assert generic copy and no application-specific claim. — 49dd034

#### Manual

- [ ] 3.4 Verify random and foreign application IDs show the same application-specific fallback.
- [ ] 3.5 Verify unrelated unknown routes use generic 404 copy without leaking identifiers or errors.

### Phase 4: Verification and CI E2E

#### Automated

- [x] 4.1 `npm run test:coverage` passes all configured thresholds. — cff7443
- [x] 4.2 `npm run lint` passes. — cff7443
- [x] 4.3 `npm run typecheck` passes. — cff7443
- [x] 4.4 CI `npm run test:e2e` passes populated, empty, detail, RLS/not-found, responsive, axe, and 500-row timing coverage. — 9ff0dd4

#### Manual

- [x] 4.5 Review CI artifacts for the measured 500-row duration and Playwright/axe results. — 8a0f27b
- [x] 4.6 Smoke-test list-to-detail navigation and recovery links on desktop and mobile after CI passes. — 8a0f27b
