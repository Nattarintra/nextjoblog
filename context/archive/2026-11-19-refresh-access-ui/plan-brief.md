# Refresh Access (Story 0) UI — Plan Brief

> Full plan: `context/changes/refresh-access-ui/plan.md`
> Research: `context/changes/refresh-access-ui/research.md`

## What & Why

Update the 13 Story 0 screens (login, sign up, forgot/reset password, redirected login, status screens, Session Check Failed, toast, Account dialog) to the new designs in `supabase/docs/nextjoblog-mvp-screens.html`. UI only: the auth flow and behaviour do not change. The refresh is also the moment to remove a second, parallel design system and hard-coded copy.

## Starting Point

Auth screens run on ~30 class strings in `components/auth/styles.ts` that duplicate the shared `ui/` kit, in a single 425px column at every width. Four status screens repeat the same markup, copy lives in JSX, and the toast and dialog differ from the design.

## Desired End State

Every Story 0 screen matches the design at ~390px and ~1280px, with a desktop brand panel beside the form. One implementation each of alert, button, field, status screen, steps, toast and dialog; no `styles.ts`, no inline hex colours, no auth copy in components. Tests and axe pass at both widths.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Copy | Adopt the design's wording; move to `lib/auth/messages.ts`; update tests | One home for copy, matches design | Research |
| Dark surface API | `data-surface="dark"` on `AuthLayout` + CSS variables read by `ui/` | No per-component prop; one kit | Research |
| Toast/Dialog | Shared `ui/Toast` and `ui/Dialog` | Remove duplicated overlay/banner code | Research |
| Background | Dedicated `--auth-bg` `#010812` everywhere, incl. Session Check Failed | `--color-ink` is the wrong colour | Research |
| Breakpoint | Tailwind `md` (768px) vs design 760px | Accept 8px difference | Research |
| SessionExpiryNoticeDialog | Migrate to `Dialog` with `tone="dark"`, current navy look kept | Same structure as AccountSheet; no design exists for it | Plan, review F2 |
| Dialog API | `tone: light \| dark`, `onEscape` only; keyboard hook moves to `lib/hooks/use-dialog-keyboard-navigation.ts` | `components/ui` must not import from `app/` | Review F2 |
| PasswordInput | Keeps own markup/ARIA; reuses only shared control and label tokens | `FormField` lacks `role="alert"`, external `describedBy`, `warning` and custom ids | Review F1 |
| AuthLayout semantics | Form panel is the single `<main>`; brand panel `aria-hidden` | No auth page has a landmark today; avoids test and screen-reader noise | Review F4 |
| Axe coverage | Shared axe helper run inside existing specs per a screen-reach table | Most of the 13 screens need special states | Review F5 |
| Button dark styling | Variables under `data-surface`, plus a `danger-outline` variant | Consistent with the surface decision | Plan |
| Phasing | Foundation, auth screens, protected side, cleanup | Each phase shippable; copy tests land with their screen | Plan |
| Visual check | Playwright screenshots + axe at 390/1280, manual review; no committed baselines | Avoid brittle baselines across 13 screens | Plan |

## Scope

**In scope:** tokens, dark surface in `ui/`, `AuthLayout` and brand panel, shared status components, copy to `messages.ts`, `ui/Toast`, `ui/Dialog` (AccountSheet and SessionExpiryNoticeDialog) and the relocated dialog keyboard hook, Session Check Failed, test updates, responsive/axe verification.

**Out of scope:** server actions, `lib/auth/*` state, `use-countdown`, resend cooldown value, routes, light-surface redesign, screenshot baselines, a password toggle on signup.

## Architecture / Approach

`AuthLayout` sets `data-surface="dark"`; `ui/Button`, `Alert`, `FormField`, `TextInput` read `--surface-*` variables (`PasswordInput` reuses the control and label tokens but keeps its own markup) with light defaults on `:root`. Screens compose `AuthHeader`, fields, `AuthStatusScreen` (+ `StatusSteps`, `EmailChip`, `WaitCard`, `RequirementList`) and `AuthFooter`. `PasswordUpdatedToast` and `AccountSheet` keep their logic and render `Toast` and `Dialog`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Foundation | Tokens, surface-aware `ui/` kit, `AuthLayout`/brand panel, messages | Regressing light-surface components |
| 2. Auth screens | Login, signup, forgot, reset on shared kit + status components; tests updated | Test churn from copy changes; focus/a11y regressions |
| 3. Protected side | `Toast`, `Dialog`, Session Check Failed | Dialog focus trap/Esc; session-expiry e2e |
| 4. Cleanup and verification | Dead code removed; axe + screenshots at 390/1280 | Dark-surface contrast fixes |

**Prerequisites:** `supabase start` for e2e; read the Next.js guide in `node_modules/next/dist/docs/` per `AGENTS.md`.
**Estimated effort:** ~4 sessions, one per phase.

## Open Risks & Assumptions

- Dark-surface contrast may need token tweaks after axe runs.
- Light surfaces are verified against reference screenshots taken before Phase 1, plus e2e in every phase.
- Only `LOGOUT_MESSAGES.stillSignedIn` changes wording; other logout messages stay.
- Variable-based `ui/` variants must leave light surfaces pixel-identical.
- Assumes no Next.js API changes affect client components or `next/link`.

## Success Criteria (Summary)

- All 13 screens match the design at mobile and desktop widths
- Auth behaviour, a11y (focus, roles, aria wiring) and all tests unchanged except deliberate copy updates
- One shared implementation per UI piece; no auth `styles.ts`, hard-coded copy or colours
