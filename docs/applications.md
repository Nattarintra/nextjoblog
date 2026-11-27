# Applications module

Story 1.2: optional job details (closing date, salary, work arrangement, contract type, track and required technologies) are saved with an application and shown on `/applications/{id}`. New rows start with status `applied`.

## Layout

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pages | `app/(protected)/applications/` (`page.tsx` list, `new/page.tsx` form, `[id]/page.tsx` detail) | Call `requireSession()`, load data, compose components. Route-private UI lives in `_components/`. |
| Server Action | `app/actions/applications.ts` | Thin adapter: parse `FormData`, call the service, map the result to form state. |
| Pure domain | `lib/applications/` (`validation`, `url`, `dates`, `status`, `form-data`, `messages`, `limits`) | No I/O. Table-driven unit tests, 90% coverage gate in `vitest.config.mts`. |
| Service + ports | `lib/applications/log-application.ts`, `ports.ts` | Orchestrates validate then write through an injected writer. |
| Repository | `lib/applications/repository.ts` | The only code that touches Supabase for applications. Takes a client as an argument. |
| UI kit | `components/ui/` | Reusable, presentation-only primitives (Button, FormField, DatePicker, ...). |
| Navigation | `components/navigation/`, `lib/navigation/`, `app/(protected)/_components/` | Side nav, drawer, account menu. |

Copy lives in `lib/applications/messages.ts`; limits in `limits.ts`; routes in `paths.ts`. Do not inline strings or numbers elsewhere.

## Optional job details

The add form renders optional fields from the domain tables in `lib/applications/job-details.ts` and `lib/applications/types.ts`. To add a field, update the field-name/value tables, validation rules, and repository allow-list derived from those tables; keep labels, messages and limits in their corresponding `lib/applications/` modules. The form and detail view should continue to map those tables rather than add field-specific branches.

The detail route is `/applications/{id}`. Empty values render as `—` with an accessible “Not provided” label. Shared choice labels are used throughout; the database value `contract` is displayed as **Fixed-term**.

## Migration

One forward-only migration in `supabase/migrations/` (copied identically to `supabase-test/`): changes the `status` default from `interested` to `applied` and adds the `on_application_created` trigger, which writes the first `status_history` row in the database (security definer, execute revoked from client roles). Existing rows keep their status. Rollback is a new migration restoring the default and dropping the trigger. Covered by `supabase/tests/database/applications.test.sql` (default, trigger, RLS).

There is no migration for Story 1.2: the optional columns already exist and are covered by the database round-trip and RLS tests.

## Tests

- Unit and component: `npm run test:run` (Vitest, React Testing Library).
- SQL: `supabase test db`.
- E2E and a11y: `e2e/applications.spec.ts` (Playwright + `@axe-core/playwright`), run in CI via `npm run test:e2e`. The save-failure path aborts the Server Action request with `page.route`, so no server hook is needed.

The E2E suite is CI-only for this project. The authoritative runner is the
Ubuntu GitHub Actions job, which starts Supabase, resets the database, installs
Playwright Chromium, and runs `npm run test:e2e`. Local macOS 13 development is
not expected to provide a compatible Chromium runtime. The CI environment must
provide Node 22, the Supabase CLI, Docker, and the service-role credentials
injected by `scripts/run-e2e.mjs`.
