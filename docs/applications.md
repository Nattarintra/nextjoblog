# Applications module

Story 1.1: log a new application with the five required fields (title, company, applied date, location, job posting link). New rows start with status `applied`.

## Layout

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pages | `app/(protected)/applications/` (`page.tsx` list, `new/page.tsx` form) | Call `requireSession()`, load data, compose components. Route-private UI lives in `_components/`. |
| Server Action | `app/actions/applications.ts` | Thin adapter: parse `FormData`, call the service, map the result to form state. |
| Pure domain | `lib/applications/` (`validation`, `url`, `dates`, `status`, `form-data`, `messages`, `limits`) | No I/O. Table-driven unit tests, 90% coverage gate in `vitest.config.mts`. |
| Service + ports | `lib/applications/log-application.ts`, `ports.ts` | Orchestrates validate then write through an injected writer. |
| Repository | `lib/applications/repository.ts` | The only code that touches Supabase for applications. Takes a client as an argument. |
| UI kit | `components/ui/` | Reusable, presentation-only primitives (Button, FormField, DatePicker, ...). |
| Navigation | `components/navigation/`, `lib/navigation/`, `app/(protected)/_components/` | Side nav, drawer, account menu. |

Copy lives in `lib/applications/messages.ts`; limits in `limits.ts`; routes in `paths.ts`. Do not inline strings or numbers elsewhere.

## Extending

Story 1.2 optional fields: pass `optionalSection` to `ApplicationFormFields`, extend `FieldName`/validation, and add columns to the repository's insert and select lists.

## Migration

One forward-only migration in `supabase/migrations/` (copied identically to `supabase-test/`): changes the `status` default from `interested` to `applied` and adds the `on_application_created` trigger, which writes the first `status_history` row in the database (security definer, execute revoked from client roles). Existing rows keep their status. Rollback is a new migration restoring the default and dropping the trigger. Covered by `supabase/tests/database/applications.test.sql` (default, trigger, RLS).

## Tests

- Unit and component: `npm run test:run` (Vitest, React Testing Library).
- SQL: `supabase test db`.
- E2E and a11y: `e2e/applications.spec.ts` (Playwright + `@axe-core/playwright`), run in CI via `npm run test:e2e`. The save-failure path aborts the Server Action request with `page.route`, so no server hook is needed.
