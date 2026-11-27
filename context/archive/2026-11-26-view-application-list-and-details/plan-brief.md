# View Application List and Details — Plan Brief

> Full plan: `context/changes/view-application-list-and-details/plan.md`
> Research: `context/changes/view-application-list-and-details/research.md`

## What & Why

Complete Story 1.4 so job seekers can see their application list, open an application detail page, and recover safely from missing or deleted application links. The work closes the gap between the existing implementation, the Applications design, and the story’s 500-application performance requirement.

## Starting Point

Protected list/detail routes, Supabase reader ports, newest-first ordering, reusable UI primitives, empty states, safe posting links, and optional-value formatting already exist. The current implementation is capped at 50 rows and uses an application-specific global 404 instead of a route-local application fallback.

## Desired End State

The list displays up to 500 visible applications in deterministic newest-first order, with responsive role/company, location, applied-date, and status presentation. Detail pages show the complete Story 1.4 contract: the required title, company, applied date, location and posting URL fields; the optional closing date, work format, contract type, discipline, technology stack and salary fields; and the current status. Missing/foreign IDs show “Application not found” with links back to Applications and Dashboard.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Detail scope | Required/optional form fields plus current status | Matches existing types, queries, and Story 1.4 boundaries | Research / Plan |
| List layout | Responsive four-column refinement of the semantic list | Improves design fidelity while preserving reuse and keyboard access | Design / Plan |
| List capacity | Explicit 500-row maximum | Meets the story and design without pagination | Change / Research |
| Not-found handling | Route-local application fallback plus generic root fallback | Matches Next.js route conventions and avoids misleading unrelated 404s | Research |
| Query/index strategy | Keep projection, ordering, owner scoping, and current index initially | Avoids an unnecessary migration; validate at 500 rows first | Research / Plan |
| Testing | Unit/component plus CI Playwright/axe | Protects pure logic, route boundaries, RLS, accessibility, and real performance | Plan |
| Search/filter | Excluded from this change | Coupled Stories 1.11–1.13 need a separate URL/query contract | Research |

## Scope

**In scope:**

- 500-row bounded list and tests
- Responsive list row refinement
- Story 1.4 detail field verification
- Application-specific and generic not-found boundaries
- Unit/component coverage and CI-only E2E/axe/performance verification

**Out of scope:**

- Search/filter, board, pagination, edit, delete
- Recruiter, notes, history, rejection, reminders, and documents
- Database migrations unless CI proves one is necessary

## Architecture / Approach

Server pages continue to guard sessions, load through injected application reader ports, and compose small UI components. The repository preserves the summary projection and deterministic ordering with a 500-row limit. The dynamic detail route continues to use `notFound()`, which resolves to a nested `[id]/not-found.tsx`; the root `not-found.tsx` becomes generic.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data contract and capacity | 500-row bound, cap messaging, repository tests | Hidden assumptions around the old 50-row cap |
| 2. Responsive presentation | Design-aligned list/detail UI and a11y tests | Avoiding a regression in keyboard/mobile behavior |
| 3. Not-found boundaries | Correct application and generic 404 states | Preserving anti-enumeration and auth ordering |
| 4. CI E2E verification | RLS, axe, responsive, and 500-row timing evidence | Shared CI timing variance |

**Prerequisites:** Existing Supabase schema/RLS, Playwright CI environment, and service-role test seeding access.

**Estimated effort:** Approximately 2–3 implementation sessions across four phases.

## Open Risks & Assumptions

- The Story 1.4 detail contract is limited to the required and optional application form fields plus current status; related feature data remains out of scope.
- The CI performance gate starts immediately before `page.goto('/applications')` in an authenticated context, ends when the list landmark and 500th row are visible, excludes setup/authentication, and allows up to 2,500 ms with the raw duration reported.
- The current owner/applied-date index is assumed sufficient for 500 rows; CI evidence determines whether a migration is needed.

## Success Criteria (Summary)

- Users can view and open all visible applications up to the 500-row bound with correct ordering and responsive/a11y behavior.
- Optional detail values never display as `null` or broken blank fields.
- Missing, deleted, and foreign IDs share a safe application-specific fallback, while unrelated 404s remain generic.
- Coverage gates and CI E2E/axe/performance checks pass.
