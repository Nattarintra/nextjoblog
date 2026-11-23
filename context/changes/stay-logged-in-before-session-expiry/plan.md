# Stay Logged In Before Session Expiry Implementation Plan

## Overview

Implement the designed session-extension flow for protected NextJobLog pages. When the application-managed login reaches its final two days, a responsive accessible prompt will let the user extend the current expiry by one session lifetime, with atomic server-side protection against double extension, cross-tab coordination, a confirmed success toast, and a calm expired-login route.

## Current State Analysis

The repository already has the application-owned expiry model: `session_extensions.extended_until` is combined with the Supabase-derived expiry using `max()`, and `requireSession()` is the authoritative protected-route guard. The protected layout passes the effective expiry into `ProtectedAppShell`, where the current notice already performs an initial threshold check, bounded timer scheduling, and cookie-keyed dismissal.

The implementation is incomplete in the areas covered by the active design. `extendSession()` reads the current expiry and unconditionally upserts `+30 days`, so concurrent tabs can add the lifetime twice. The notice has no visibility recheck or cross-tab coordination; the shared dialog lacks described content, backdrop dismissal, and focus restoration; the UI has no server-date success toast or designed retry state; and the expired-login redirect lacks `reason=session_expired` and its informational login message. The existing Playwright suite already provides short-timebox, RLS, and expired-route fixtures that can be extended.

The local Next.js 16 guidance confirms that `proxy.ts` should remain an optimistic, database-free check and that authoritative application session enforcement belongs in the protected route/data-access path. Server Actions remain untrusted entry points and must authenticate and authorize inside the action. Cookie writes are available through the async `cookies()` API in Server Actions or Route Handlers.

## Desired End State

An authenticated user on any protected page sees the designed “Stay logged in?” prompt when the effective expiry enters the two-day window. The prompt shows local absolute dates and relative timing, can be dismissed once per expiry cycle, coordinates across tabs, and extends only when the server confirms an atomic compare-and-set operation.

Successful extension closes the prompt, keeps the user on the same page, and shows a shell-level toast using the server-returned expiry. Failed or stale requests never display a speculative date. Once the effective expiry is reached, protected requests fail closed, clean up the local Supabase session, preserve a sanitized deep link, and render the generic “Your login ended” login state.

### Key Discoveries:

- `lib/session/service.ts:17-61` already computes the application effective expiry; the new work must preserve the `max(base, extended)` model.
- `lib/auth/require-session.ts:30-52` is the correct expiry enforcement boundary; `proxy.ts` must not gain a database lookup.
- `lib/session/extension-store.ts:48-63` is the concurrency defect: its unconditional upsert must become a compare-and-set RPC boundary.
- `ProtectedAppShell.tsx:29-73` is the correct cross-page owner for the prompt and success toast.
- `Dialog.tsx:8-45` and `use-dialog-keyboard-navigation.ts:11-37` provide reusable modal semantics and focus trapping, but need backward-compatible extensions.
- `supabase/migrations/README.md:1-6` requires every migration to be copied to `supabase-test/supabase/migrations/`.
- `.github/workflows/playwright.yml:34-89` and `playwright.config.ts:1-28` establish Ubuntu CI as the authoritative Supabase-backed E2E environment.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Persistence model | Keep one `session_extensions` row per `session_id`, using `extended_until` as application `expires_at` | Matches the existing schema, RLS, and effective-expiry calculation without a rename or history table | Research |
| Concurrency boundary | Supabase Postgres RPC with atomic compare-and-set | A read followed by unconditional upsert can extend one cycle twice across tabs | Research |
| Client cycle identity | Server-rendered signed opaque cycle token verified by the Server Action | The browser cannot author or submit a replacement date, while the action can recover the verified expected cycle for the RPC | Plan |
| Stale CAS result | Reconcile and close the local prompt, then refresh the shell | Another tab has already won; closing stale UI avoids duplicate retry behavior and refreshes the expiry | Plan |
| Prompt persistence | Cookie keyed to the current expiry value | Dismissal is durable within a cycle and automatically resets when the expiry changes | Research |
| Cross-tab coordination | `BroadcastChannel` with `storage` event fallback | Native coordination is immediate where available, while older browsers still close stale prompts | Research |
| Success toast | In-memory state owned by the protected shell | The toast survives prompt removal and is not a stale notification after a full reload | Plan |
| Dialog dismissal | Escape and backdrop click persist the same-cycle dismissal | All non-extension closes have the designed “no change” semantics and should not immediately reopen | Plan |
| Database verification | pgTAP plus action unit tests and Playwright E2E | SQL atomicity/RLS, server mapping, and real browser behavior require separate coverage layers | Plan |
| Schema documentation | Add `session_extensions` and the RPC to the canonical schema document | The research found an existing documentation gap that would otherwise remain | Plan |
| Expired login | `/login?reason=session_expired&next=...` with generic informational copy | Preserves safe deep links while explaining the state without account-specific disclosure | Research |

## What We're NOT Doing

- Changing the default 30-day lifetime or adding an extension history table.
- Extending a login without an explicit user action.
- Adding account-wide session management, device revocation, or a new session-management screen.
- Moving application expiry enforcement into `proxy.ts` or making Proxy query Supabase tables.
- Persisting success toasts through reloads.
- Reworking the broader authentication visual language beyond the specified prompt, toast, failure state, and expired-login message.
- Requiring local Playwright Chromium execution on the macOS 13 development machine.

## Implementation Approach

The change proceeds from the database boundary outward. A security-hardened RPC will compare the authenticated session row to the expected cycle and update/insert exactly once. The server action will authenticate, verify a server-issued cycle token, reject expired sessions, call the RPC, and return either the server-confirmed expiry or a safe conflict/failure result.

The protected shell will pass the effective expiry and signed cycle token to a client notice hook. The hook will manage threshold timing, visibility changes, the per-cycle cookie, and cross-tab messages. The dialog will consume the shared `Dialog` primitive, while the shell owns the confirmed toast. The existing `requireSession()` and expired-session cleanup route will be retained and extended only to add the reason parameter and login presentation.

## Critical Implementation Details

### Timing & lifecycle

The notice must recalculate on initial mount, when the document becomes visible, and at the computed threshold rather than using fixed polling. Cleanup must remove timers, document listeners, channel listeners, and storage listeners on unmount or expiry-token change. A cycle response is keyed to the exact effective expiry; a successful extension therefore begins a fresh cycle automatically.

### State sequencing

The action must verify the signed token before deriving the RPC expected value. The UI must not close as a success or calculate a new date until the RPC returns the new persisted expiry. A stale CAS response closes and refreshes the local prompt; a transport/server error keeps the prompt open and shows only the unchanged end date.

### User experience spec

The prompt remains a bottom sheet on mobile and a centered dialog on desktop using the existing responsive class pattern. Its initial focus is the primary “Yes, stay logged in” action; close paths restore the element focused before opening. The error copy is a live `role="alert"`, and the success toast uses `role="status"` with the server-returned local date.

## Phase 1: Database Compare-and-Set Foundation

### Overview

Add the atomic persistence operation and database-level verification without changing the existing effective-expiry calculation.

### Changes Required:

#### 1. Session extension migration and test mirror

**File**: `supabase/migrations/20261123110000_add_session_extension_rpc.sql`

**Intent**: Define a Postgres function that atomically accepts the authenticated session, the expected raw extension value (nullable for no row), and the verified effective expiry cycle; updates the existing row or inserts the first row only when the stored row still matches that expected raw value. Return a result that distinguishes success from a stale/conflicting cycle without exposing account details.

**Contract**: The RPC must derive ownership from `auth.uid()`, use a fixed `search_path`, be safe as a `security definer` function if needed for the conditional operation, expose only the minimum execute privilege, and return the new `extended_until` on success. It must support: no row + base expiry, matching row + effective expiry equal to `max(baseExpiry, extended_until)`, and stale/mismatched row rejection with no write. The RPC must not accept `user_id` or an arbitrary extension lifetime from the browser; the lifetime is the fixed application session lifetime (30 days in this change), and any environment-specific test lifetime must be configured explicitly on both sides rather than supplied per request.

**File**: `supabase-test/supabase/migrations/20261123110000_add_session_extension_rpc.sql`

**Intent**: Keep the short-timebox Supabase project schema identical to the main migration set.

**Contract**: The copied migration must remain byte-for-byte behaviorally equivalent, following `supabase/migrations/README.md`.

#### 2. Database RPC tests

**File**: `supabase/tests/database/session_extension_cas.test.sql`

**Intent**: Verify the SQL boundary independently of the browser and action mocks.

**Contract**: Cover first extension insertion from the base expected value, matching update from an existing expiry, stale expected-value rejection with no change, authenticated ownership/RLS, cross-user rejection, and repeated stale submission safety. Follow the existing pgTAP/authenticated-role conventions in `supabase/tests/database/applications.test.sql` and `rate_limit_consume.test.sql`.

#### 3. Store adapter

**File**: `lib/session/extension-store.ts`

**Intent**: Replace the unconditional upsert contract with a typed compare-and-set operation while preserving the existing read adapter used by session service.

**Contract**: Add an operation that receives `sessionId`, the verified expected effective cycle, and the expected raw stored extension (or `undefined` for no row); derive ownership from the authenticated Supabase context rather than accepting a client `userId` or lifetime. Return a discriminated success/conflict result containing the server-returned expiry only on success. Map RPC transport/schema errors to the existing failure path rather than leaking database details.

### Success Criteria:

#### Automated Verification:

- The main and short-timebox migration copies define the same RPC and grants.
- `supabase test db` passes with the new pgTAP cases.
- Store tests cover success, stale conflict, malformed RPC output, and transport failure.

#### Manual Verification:

- Review the function security posture, fixed search path, grants, and ownership checks before implementation proceeds.

## Phase 2: Server Contract and Expiry Redirect

### Overview

Connect the database CAS operation to the server action and complete the expired-login URL/message contract.

### Changes Required:

#### 1. Server-issued cycle token

**File**: `lib/session/cycle-token.ts`

**File**: `app/(protected)/layout.tsx`

**Intent**: Provide a server-only signing and verification boundary for the current authenticated session/cycle identity.

**Contract**: The token must bind at minimum the session ID and effective expiry, reject malformed/expired/mismatched tokens, and never make the signing secret available to the client. The payload can be transported through a client component prop, but the client must treat it as opaque.

The protected layout creates the token from the authenticated effective-expiry result and passes it through `ProtectedAppShell`; it must remain a server-to-client serialization boundary and must not expose signing material.

#### 2. Extension action

**File**: `app/actions/session.ts`

**Intent**: Preserve the current server authentication and effective-expiry checks while using the verified cycle token and CAS store operation.

**Contract**: `extendSession` must authenticate independently, reject an already expired effective session, verify that the token belongs to the current claims and observed expiry, call the RPC once, return `{ ok: true, extendedUntil }` from the database result, and map stale/transport/auth/schema failures to safe client messages. The client action must not receive a replacement date argument.

The action signature is `extendSession(previousState, formData)` through `useActionState`; `formData` contains only the opaque cycle token. The action verifies the token, re-reads the current raw extension and effective expiry, derives the expected RPC arguments server-side, and never forwards a client-supplied date, user ID, or lifetime.

**File**: `app/actions/session-messages.ts` and `lib/session/errors.ts`

**Intent**: Add stable internal conflict/error identifiers and designed user-facing copy without exposing database or account information.

**Contract**: Keep the browser-facing failure message generic; let the client distinguish a stale-cycle reconciliation result from a retryable failure.

#### 3. Expired-login URL and presentation

**Files**: `lib/auth/paths.ts`, `lib/auth/login-redirect.ts`, `app/api/auth/session-expired/route.ts`, `app/login/page.tsx`, `app/login/LoginForm.tsx`, `app/login/LoginAlert.tsx`, `lib/auth/messages.ts`

**Intent**: Preserve current safe `next` handling while adding a stable `reason=session_expired` branch and the calm informational login state from the design.

**Contract**: The route redirects to `/login?reason=session_expired&next=<sanitized-path>` when a deep link exists, rejects external `next`, uses the same generic message for every user, and renders a fresh login form with an empty email field. Existing ordinary-login and logged-out variants must remain unchanged.

### Success Criteria:

#### Automated Verification:

- Action tests prove the client cannot choose a replacement expiry, successful results use the RPC-returned timestamp, and stale results are distinguishable from retryable failures.
- Login redirect tests cover the reason parameter, safe deep-link preservation, external `next` rejection, and unchanged ordinary redirect behavior.
- `npm run typecheck` (`tsc --noEmit`) and `npm run lint` pass for the new token/action/login contracts; add the missing `typecheck` script to `package.json` if it is still absent.

#### Manual Verification:

- Confirm the expired-login screen matches the supplied design copy and does not prefill account-specific email data.

## Phase 3: Protected-Shell Lifecycle and Cross-Tab State

### Overview

Make the notice reliable while a protected page remains open, including tab visibility changes, cycle dismissal, cross-tab answers, stale-result reconciliation, and shell-level success feedback.

### Changes Required:

#### 1. Notice timing and coordination

**Files**: `app/(protected)/layout.tsx`, `app/(protected)/_components/session-expiry-notice.ts`, `app/(protected)/_components/useSessionExpiryNotice.ts`, `app/(protected)/_components/SessionExpiryNotice.tsx`, `app/(protected)/_components/SessionExpiryNoticeDialog.tsx`

**Intent**: Extend the existing threshold hook rather than replacing it, retaining the cookie as durable cycle state while adding browser lifecycle and cross-tab behavior.

**Contract**: Recheck on mount, `visibilitychange` to visible, and the threshold timer. Persist the current expiry value for every non-extension dismissal. Broadcast `{ cycle, outcome }` through `BroadcastChannel` when available and a uniquely keyed `storage` event fallback otherwise; receiving a matching answer must close stale UI without submitting. All resources must be cleaned up.

#### 2. Shell-level toast and modal arbitration

**Files**: `app/(protected)/_components/ProtectedAppShell.tsx`, `app/(protected)/_components/useShellModals.ts`, `app/(protected)/_components/SessionExtensionToast.tsx`, `app/(protected)/_components/SessionExpiryNotice.tsx`

**Intent**: Keep the existing drawer/account/expiry modal arbitration and add in-memory state for the server-confirmed extension toast.

**Contract**: The shell receives the signed cycle token and passes it to the notice. A successful result sets toast state from the returned `extendedUntil`; stale results close and refresh; retryable failures remain in the dialog. The toast is dismissed manually or by the existing short-lived in-memory lifecycle and is not persisted through reload.

Ownership remains explicit: `useSessionExpiryNotice` owns threshold, dismissal, and cross-tab lifecycle; `SessionExpiryNoticeDialog` owns prompt rendering and pending/error controls; `ProtectedAppShell` owns modal arbitration and the confirmed success toast. Update the existing layout, shell, notice, dialog, hook, and direct component tests together.

#### 3. Extension client hook

**File**: `app/(protected)/_components/useSessionExtension.ts`

**Intent**: Adapt the current `useActionState` wrapper to expose success metadata and distinguish stale reconciliation from retryable errors.

**Contract**: The hook must dispatch with the opaque token, remain safe when offline, call success only after server confirmation, and preserve the same request identity on retry. It must not derive or submit a new expiry date on the client.

### Success Criteria:

#### Automated Verification:

- Timing tests cover initial threshold, timer rearming, expiry boundary, visibility recheck, and cleanup.
- Browser-state tests cover cookie cycle reset, BroadcastChannel delivery/cleanup, storage fallback, matching-cycle filtering, and stale-result reconciliation.
- Shell tests prove only one modal is active and the success toast renders from returned server data.

#### Manual Verification:

- Open the same protected route in two tabs, answer in one, and verify the other closes without a second request.
- Leave a tab open across the threshold, background/foreground it, and verify the prompt appears or remains suppressed according to the current cycle cookie.

## Phase 4: Accessible Designed UI

### Overview

Implement the supplied prompt, success, failure, and expired-login visual behavior using existing design-system primitives and responsive shell classes.

### Changes Required:

#### 1. Shared dialog primitive

**File**: `components/ui/Dialog.tsx`

**Intent**: Add the minimum reusable semantics required by the expiry prompt while preserving existing drawer/account consumers.

**Contract**: Support optional `aria-describedby`, backdrop dismissal, and restoration to the element focused before open. Existing Escape handling, focus trapping, `aria-modal`, tone, and busy behavior remain backward compatible; backdrop clicks inside the surface must not dismiss.

#### 2. Prompt and failure dialog

**File**: `app/(protected)/_components/SessionExpiryNoticeDialog.tsx`

**Intent**: Replace the generic Yes/No dialog with the designed warning prompt and retry state.

**Contract**: Render `role="dialog"`, `aria-modal`, heading/description IDs, “Ends in 2 days,” local absolute current/new dates, and the explanatory copy. Primary action is “Yes, stay logged in”; secondary action is “Not now.” On failure, render the exact generic alert copy with unchanged end date and “Try Again”/“Not now”; never render an optimistic new date. Use the signed token and return callbacks supplied by the shell/hook.

#### 3. Date and toast presentation

**Files**: `app/(protected)/_components/session-date-formatting.ts`, `components/ui/Toast.tsx`, `app/(protected)/_components/SessionExtensionToast.tsx`

**Intent**: Centralize local date/time and relative-label formatting and match the desktop/mobile toast placement from the design.

**Contract**: Format absolute dates using the browser’s local timezone, include the relative “Ends in 2 days” label at the dialog boundary, and use only the server-returned expiry in the success toast. Preserve `role="status"`, dismiss control, and responsive top-right desktop placement.

#### 4. Login expired messaging

**Files**: `app/login/*` and `lib/auth/messages.ts` as identified in Phase 2

**Intent**: Match the calm informational “Log In Again” state in the design, including the statement that applications are safe.

**Contract**: The reason branch must not be an error treatment, must leave the email input empty, and must preserve the existing login action and safe `next` destination.

### Success Criteria:

#### Automated Verification:

- Dialog tests cover ARIA labelling/describing, initial focus, Escape, backdrop dismissal, inside-click behavior, focus restoration, and busy state.
- Prompt tests cover exact action labels, local date output, error `role="alert"`, unchanged-date failure state, retry, and toast `role="status"`.
- Responsive accessibility assertions pass for desktop and 390px mobile markup.

#### Manual Verification:

- Compare the prompt, success toast, failure state, and expired-login screen against `supabase/docs/nextjoblog-session-expiry-screens.html` at desktop and mobile widths.
- Verify keyboard-only use: initial focus on the primary action, Tab containment, Escape/backdrop close, restored focus, and screen-reader announcement of failure.

## Phase 5: Verification, E2E, and Documentation

### Overview

Complete regression coverage across the real Supabase stack, document the schema/RPC, and preserve the repository’s CI-only E2E constraint.

### Changes Required:

#### 1. Unit and integration coverage

**Files**: `__tests__/actions/session.test.ts`, `__tests__/dashboard/SessionExpiryNotice.test.tsx`, `__tests__/dashboard/SessionExpiryNoticeDialog.test.tsx`, `__tests__/protected/layout.test.tsx`, `__tests__/protected/ProtectedAppShell.test.tsx`, `__tests__/lib/auth/core.test.ts`, `__tests__/lib/auth/require-session.test.ts`, `__tests__/api/auth/session-expired.test.ts`, `__tests__/ui/ToastDialog.test.tsx`, plus focused tests for new pure/token/date modules

**Intent**: Replace assertions for unconditional upsert/generic UI with coverage for the final CAS, lifecycle, accessibility, and server-date behavior.

**Contract**: Maintain at least 80% global lines/statements/functions/branches and the existing stricter auth thresholds; do not exclude new session/auth files to make coverage pass.

#### 2. Playwright scenarios

**Files**: `e2e/session-expiry.spec.ts`, `e2e/session-expired-route.spec.ts`, `e2e/helpers/auth-session.ts`, and any new E2E helper

**Intent**: Exercise the real RPC and browser behavior in the established Ubuntu CI environment.

**Contract**: Cover designed success/failure states, two-tab/double-submit CAS protection, cross-tab closure, repeated extension cycles, RLS ownership, expired redirect with `reason=session_expired`, sanitized deep-link preservation, and absence of protected data after expiry. Update existing selectors/assertions for the redesigned “Yes, stay logged in”, “Try Again”, dialog, and toast copy. Preserve the short-timebox stack swap and `workers: 1` ordering.

#### 3. Schema documentation and CI notes

**Files**: `package.json`, `supabase/docs/nextjoblog-supabase-schema-en.md`, `supabase/migrations/README.md`, `.github/workflows/playwright.yml`, `playwright.config.ts` only if required by the final test shape

**Intent**: Document the existing session-extension table, RPC contract/security posture, manual migration mirror, and authoritative E2E environment.

**Contract**: Documentation must match the migration names and actual RPC signature; CI must continue to run database tests before Playwright and must not make unsupported local macOS Chromium a prerequisite.

Add `"typecheck": "tsc --noEmit"` to `package.json` and run lint, typecheck, unit tests, and coverage in CI. Run pgTAP against the primary Supabase project; validate the mirrored `supabase-test` migration byte-equivalence separately, with the short-timebox E2E stack exercising that mirror.

### Success Criteria:

#### Automated Verification:

- `npm run test:run` passes.
- `npm run test:coverage` passes all existing thresholds.
- `npm run lint` and `npm run typecheck` pass.
- Primary `supabase db reset` and `supabase test db` pass; the mirrored migration remains byte-equivalent and is exercised by the short-timebox E2E stack.
- GitHub Actions Ubuntu E2E passes with the real RPC and Playwright scenarios.

#### Manual Verification:

- Review the final screens against the design at 1280px and 390px widths.
- Verify production-like dates use the user’s local timezone and never display a client-calculated success date.
- Confirm the implementation remains safe when two tabs answer simultaneously and when a request crosses the expiry boundary.

## Testing Strategy

### Unit Tests:

- Pure expiry threshold, timer delay, relative label, and local date formatting.
- Signed token creation/verification, claim binding, malformed/expired token rejection.
- Store/RPC result mapping, first-row insertion, matching update, stale conflict, RLS/transport failure mapping.
- Notice cookie lifecycle, visibility recheck, timer cleanup, BroadcastChannel/storage coordination, repeated cycles.
- Dialog ARIA, focus trap/restoration, Escape/backdrop behavior, pending/error/retry rendering.
- Shell modal arbitration and server-confirmed toast state.
- Login reason branch, empty email field, and safe next handling.

### Integration Tests:

- pgTAP RPC tests for atomicity, ownership, security-definer posture, and no-change conflict behavior.
- Server action tests proving authentication and token verification happen before mutation.

### Manual Testing Steps:

1. Sign in and set or seed the effective expiry inside the two-day window; verify the prompt overlays dashboard, application list, and detail pages.
2. Test the mobile bottom sheet and desktop centered dialog, including keyboard focus, Escape, backdrop, and focus restoration.
3. Extend successfully; verify the prompt closes, the same page remains open, and the toast uses the returned end date.
4. Force an RPC/network failure; verify the prompt remains open, the alert is announced, the old date remains, and retry is available.
5. Open two tabs and answer in both; verify only one extension is applied and the other prompt reconciles.
6. Allow expiry to pass and request a protected deep link; verify logout, safe `next`, `reason=session_expired`, generic copy, and no protected content.

## Performance Considerations

The client uses one threshold timer rather than polling, plus event-driven visibility and cross-tab listeners. The RPC performs a single indexed primary-key lookup/update on `session_id`; no new history table or periodic server job is introduced. Proxy remains database-free, preserving the existing request-time performance boundary.

## Migration Notes

Apply the new migration to both the main and `supabase-test` migration trees. Deploy the RPC before the updated Server Action. The action should map missing/unavailable RPC results to the existing safe failure state so a partially deployed database cannot extend sessions incorrectly. Rollback can remove the action call path first, then revert the migration/RPC; existing `extended_until` data remains compatible.

## References

- Related change: `context/changes/stay-logged-in-before-session-expiry/change.md`
- Related research: `context/changes/stay-logged-in-before-session-expiry/research.md`
- Source design: `supabase/docs/nextjoblog-session-expiry-screens.html:542-615,729-737`
- Effective expiry: `lib/session/calculations.ts:3-15`, `lib/session/service.ts:17-61`
- Protected guard: `lib/auth/require-session.ts:30-52`
- Current action/store gap: `app/actions/session.ts:37-69`, `lib/session/extension-store.ts:22-63`
- Protected shell: `app/(protected)/_components/ProtectedAppShell.tsx:29-73`
- Dialog primitive: `components/ui/Dialog.tsx:8-45`
- Existing CI/E2E: `.github/workflows/playwright.yml:34-89`, `e2e/session-expiry.spec.ts:122-291`
- Next.js guidance: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Compare-and-Set Foundation

#### Automated

- [x] 1.1 Migration and mirrored test migration define the atomic session-extension RPC and grants — 4a592e7
- [x] 1.2 pgTAP covers first extension, matching update, stale conflict, ownership, and cross-user rejection — 4a592e7
- [x] 1.3 Store tests cover RPC success, conflict, malformed output, and transport failure — 4a592e7

#### Manual

- [x] 1.4 Security review confirms fixed search path, minimal grants, and authenticated ownership checks — 4a592e7

### Phase 2: Server Contract and Expiry Redirect

#### Automated

- [x] 2.1 Action tests cover signed-token verification, server-returned expiry, stale conflict, and safe failures — eb8afc7
- [x] 2.2 Login redirect tests cover reason parameter, safe next preservation, external next rejection, and ordinary redirects — eb8afc7
- [x] 2.3 Type checking and linting pass for token, action, and login contracts — eb8afc7

#### Manual

- [x] 2.4 Expired-login screen matches the design and leaves the email field empty — eb8afc7

### Phase 3: Protected-Shell Lifecycle and Cross-Tab State

#### Automated

- [x] 3.1 Timing tests cover initial check, threshold timer, expiry boundary, visibility, and cleanup — 3925a39
- [x] 3.2 Cross-tab tests cover BroadcastChannel, storage fallback, cycle filtering, cookie state, and stale reconciliation — 3925a39
- [x] 3.3 Shell tests cover modal arbitration and server-confirmed in-memory toast state — 3925a39

#### Manual

- [x] 3.4 Two-tab and background/foreground behavior matches the current expiry cycle — 3925a39

### Phase 4: Accessible Designed UI

#### Automated

- [x] 4.1 Dialog tests cover ARIA, initial focus, focus restoration, Escape, backdrop, and busy behavior — 955c4e6
- [x] 4.2 Prompt tests cover local dates, action labels, failure alert, unchanged date, retry, and success toast — 955c4e6
- [x] 4.3 Responsive accessibility assertions pass at desktop and 390px mobile widths — 955c4e6

#### Manual

- [x] 4.4 Prompt, toast, failure, and expired-login screens match the supplied design at desktop and mobile widths — 955c4e6
- [x] 4.5 Keyboard-only and screen-reader interaction is usable across all dialog states — 955c4e6

### Phase 5: Verification, E2E, and Documentation

#### Automated

- [x] 5.1 `npm run test:run` passes — a1fb1ae
- [x] 5.2 `npm run test:coverage` passes all existing thresholds — a1fb1ae
- [x] 5.3 `npm run lint` and `npm run typecheck` pass without weakening thresholds — a1fb1ae
- [x] 5.4 Primary Supabase reset and pgTAP database tests pass, and the mirrored migration remains byte-equivalent — a1fb1ae
- [x] 5.5 Ubuntu CI Playwright covers real RPC, concurrency, cross-tab, cycles, RLS, and expired deep links — bf427f9
- [x] 5.6 Schema and CI documentation match the implemented migration and test contract — a1fb1ae

#### Manual

- [x] 5.7 Final screens match the design at 1280px and 390px widths — bf427f9
- [x] 5.8 Production-like dates use the user's local timezone and never display a client-calculated success date — bf427f9
- [x] 5.9 Two-tab, expiry-boundary, concurrency, and protected-data checks pass — bf427f9
