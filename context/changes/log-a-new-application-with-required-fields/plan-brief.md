# Log a New Application with Required Fields (Story 1.1) — Plan Brief

> Full plan: `context/changes/log-a-new-application-with-required-fields/plan.md`
> Research: `context/changes/log-a-new-application-with-required-fields/research.md`

## What & Why

A signed-in Job Seeker logs an application with title, company, applied date, location and posting link. It is saved as `applied`, gets its first status-history row, and shows in `/applications` immediately. This is the smallest slice that replaces "just remembering". It also builds the design's main navigation and a reusable `components/ui/` kit for Stories 1.2+.

## Starting Point

Only the tables and RLS exist. No applications route, lib, action or test. The shell has no nav links; `status` still defaults to `interested`; design tokens differ from `globals.css`. Auth patterns (DI use case, thin action, field a11y, guard test) are ready to copy.

## Desired End State

`/applications/new` with a calendar date picker defaulting to today (user time zone, with a safe fallback), per-field errors, focus on the first invalid field, input kept with Retry on failure, idempotent save that never silently drops edited input. `/applications` lists rows newest-first with an empty state. Side nav (desktop) and header + drawer (mobile). CI green.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Initial status | `applied`, new migration | Applied date is required | Natta 16 Nov |
| Status history | DB insert trigger | Atomic, one place | Research / user |
| Tokens | Adopt design tokens wholesale | Single source of truth | User |
| Date field | Calendar picker via `react-day-picker`, no typing | Consistent icon/UI, a11y | User |
| Idempotency | Server-generated UUID as row id; a repeat id counts as saved only if stored fields match, else one retry with a fresh id | Safe retry, no silent loss on Back-button resubmit | User, plan review |
| Time zone | `profiles.timezone` via `time-zone.ts`, falls back to default on missing/invalid | Correct "today", no page crash | Research, plan review |
| Limits | 200 text / 2048 URL | Bound payload | User |
| Validation | Declarative `REQUIRED_FIELDS` rules | Extend in 1.2 without edits | Plan |
| Ports | Separate writer/reader interfaces | ISP, fake in tests | Plan |
| Nav | Shared `MainNav` in a static `SideNav` and an open-only `NavDrawer` dialog; one visible `nav` per width | Correct dialog roles per breakpoint, no JS viewport branching | Plan review |
| Verification | Unit locally; pgTAP + Playwright in CI | macOS 13 limit | Precedent |

## Scope

**In:** token swap, migration + SQL tests, nav shell, pure lib, service/repo/action, UI kit, form and list pages, E2E/a11y/docs.
**Out:** optional fields (1.2), search/filter, detail/edit, extra nav entries, auth component refactor, later status-history writes.

## Architecture / Approach

Pure, injected logic in `lib/applications` and `lib/navigation`; thin Server Action wires Supabase; presentational components in `components/ui`; route-private components under `app/(protected)/applications/_components`. All constants, messages and status maps live once as data.

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Token swap | Design tokens, shared fonts (Archivo 800, Work Sans 500 added) | Visual regressions on auth |
| 2. Migration | Default `applied`, history trigger, pgTAP | `supabase-test` drift |
| 3. Nav shell | Side nav, header, drawer, account dialog, wider focus-trap hook; CI-green e2e gate before Phase 4 | Breaking logout/session-expiry; stacked modals; OS dark mode |
| 4. Pure lib | Validation, dates, URL, status, messages, time zone; 90% coverage gate | Time-zone and URL edge cases |
| 5. Service/repo/action | Safe, idempotent insert; `verification_failed` keeps input | Mass-assignment, error leakage, id conflicts |
| 6. UI kit | Form primitives, DatePicker | `react-day-picker` fit |
| 7. Pages | Form + list | React 19 form reset, focus |
| 8. E2E/docs | CI evidence, axe | CI-only verification |

**Prerequisites:** Stories 0.1–0.2 done; approval to add `react-day-picker` and `@axe-core/playwright`, obtained before Phase 1.
**Estimated effort:** ~6–8 sessions.

## Open Risks & Assumptions

- `react-day-picker` compatibility with React 19 / Tailwind v4 is unverified until Phase 6; fallback is a hand-built grid behind the same props.
- Nav refactor touches existing tests and e2e selectors; Phase 3 requires a green CI run of the logout and session-expiry specs before Phase 4.
- Playwright/pgTAP cannot run locally.
- Plan review (2026-11-19): verdict SOUND after fixes, see `reviews/plan-review.md`.

## Success Criteria (Summary)

- All five ACs from `change.md` pass in component tests and one e2e path.
- Coverage ≥ 80% global, ≥ 90% `lib/applications/**`; lint and typecheck clean; CI run ID recorded.
