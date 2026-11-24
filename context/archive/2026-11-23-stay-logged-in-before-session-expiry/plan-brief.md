# Stay Logged In Before Session Expiry — Plan Brief

> Full plan: `context/changes/stay-logged-in-before-session-expiry/plan.md`
> Research: `context/changes/stay-logged-in-before-session-expiry/research.md`

## What & Why

Add a calm, actionable prompt when a protected NextJobLog login reaches its final two days. The user can extend the application-managed expiry by 30 days from the existing end date, stay on the current page, and receive confirmation without re-entering a password.

The flow must remain safe under two tabs, double submission, offline/error states, and expiry during use. If the login ends, the user is redirected to a generic login explanation while their applications remain protected and their safe deep link is preserved.

## Starting Point

The repository already derives an effective expiry from Supabase claims plus `session_extensions.extended_until`, enforces it in `requireSession()`, and mounts a basic notice in the shared protected shell. The current action unconditionally upserts a new expiry, and the current UI lacks the designed dates, retry state, cross-tab behavior, accessibility details, success toast, and expired-login reason message.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Concurrency | Postgres compare-and-set RPC against the expected raw extension row | Prevents two tabs from adding 60 days, including the no-row first cycle | Research / Plan |
| Client identity | Server-rendered signed opaque cycle token | The client never submits a replacement date | Plan |
| Stale result | Reconcile, close, refresh | Another tab has already won the cycle | Plan |
| Prompt state | Expiry-keyed cookie plus BroadcastChannel/storage | Durable cycle dismissal plus immediate tab coordination | Research |
| Toast | In-memory protected-shell state | Confirms the current action without stale reload notifications | Plan |
| Dismissal | Escape/backdrop count as “Not now” | Consistent once-per-cycle behavior | Plan |
| Database tests | pgTAP plus unit/action/E2E coverage | Validates SQL atomicity, mapping, and real browser behavior | Plan |
| Expired route | `reason=session_expired` plus sanitized `next` | Explains the state without account disclosure | Research |
| Verification commands | `npm run lint`, `npm run typecheck`, unit/coverage checks, pgTAP, and Ubuntu E2E | Makes the required verification commands executable and CI-visible | Plan |

## Scope

In scope:

- Atomic session extension RPC, grants, RLS/security tests, and test-project migration mirror. The RPC derives ownership from `auth.uid()`, accepts no client `user_id` or arbitrary lifetime, and matches the expected raw extension value before updating/inserting.
- Signed cycle token, server action mapping, lifecycle/two-tab coordination, and shell toast.
- Designed responsive dialog, failure/retry state, focus behavior, dates, and expired-login message.
- Unit, pgTAP, and Ubuntu CI Playwright verification plus schema documentation.

Out of scope:

- Changing the 30-day lifetime, extension history, device management, or account-wide session controls.
- Database reads in `proxy.ts`.
- Local Playwright execution on unsupported macOS 13 Chromium.

## Architecture / Approach

The protected layout passes the effective expiry and an opaque signed cycle token into the client shell. The client opens and coordinates the prompt, but the Server Action authenticates and verifies the token, re-reads the current raw extension/effective expiry, and derives the RPC arguments. The Postgres RPC atomically matches the expected raw row (or no-row state) and returns the persisted new expiry; the extension lifetime is fixed by the application and is never supplied by the browser. The shell then closes the prompt and shows a server-dated toast; stale responses reconcile and refresh, while errors keep the prompt open.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database CAS | Atomic RPC, grants, mirrored migration, pgTAP | SQL security or no-row/base-expiry handling |
| 2. Server contract | Signed token, action mapping, expired-login reason | Token mismatch or redirect regression |
| 3. Shell lifecycle | Visibility, timers, cookies, cross-tab state, toast | Leaked listeners or stale tab state |
| 4. Accessible UI | Design states, dates, retry, focus, responsive layout | Breaking shared dialog consumers |
| 5. Verification/docs | Unit/E2E coverage, lint/typecheck/coverage CI proof, schema docs | Flaky short-timebox/concurrency tests |

**Prerequisites:** Existing Supabase local/CI setup, `session_extensions` migration, protected shell, and the supplied design/research artifacts.

**Estimated effort:** Approximately 2–4 implementation sessions across 5 phases, with database/RPC and CI E2E work as the critical path.

## Open Risks & Assumptions

- The token signing secret must use an existing server-safe secret/configuration pattern or add one with a safe deployment fallback.
- The RPC must preserve the current first-cycle behavior where no extension row exists and the base JWT expiry is the expected effective cycle; the action supplies the verified cycle and expected raw-row state, while the RPC performs the atomic match.
- The short-timebox Playwright suite remains single-worker because it swaps the local Supabase project underneath Next.js.
- The primary Supabase project runs pgTAP; the `supabase-test` migration mirror is checked for byte-equivalence and exercised by the short-timebox E2E stack.

## Success Criteria (Summary)

- Users can extend a protected login once per expiry cycle from any protected page and see a server-confirmed local end date.
- Concurrent tabs cannot extend the same cycle twice; stale prompts reconcile and errors never show speculative dates.
- Expired sessions fail closed to the designed generic login state while safe deep links and protected-data guarantees remain intact.
- Required static verification is executable through `npm run lint` and `npm run typecheck` in addition to the existing unit, coverage, database, and Ubuntu E2E checks.
