# Refresh Access (Story 0) UI Implementation Plan

## Overview

Refresh the 13 Story 0 screens (login, sign up, forgot/reset password, redirected login, Check Your Email, Too Many Requests, Reset Link Expired, Session Check Failed, Password Updated toast, Account / Log Out dialog) to match `supabase/docs/nextjoblog-mvp-screens.html`. UI only: auth flow, server actions, `lib/auth/*` state and `use-countdown` do not change.

The approach is to stop maintaining a second parallel design system in `components/auth/styles.ts`. Instead, the shared `ui/` kit learns a dark surface (`data-surface="dark"` on `AuthLayout`), the four status screens collapse into one `AuthStatusScreen`, copy moves into `lib/auth/messages.ts`, and a shared `ui/Toast` and `ui/Dialog` are introduced.

## Current State Analysis

- Auth screens use ~30 class strings in `components/auth/styles.ts` that duplicate `ui/Button`, `ui/Alert`, `ui/FormField`/`TextInput` and `ui/control-styles.ts`, which only know the light surface.
- `AuthPageShell` is one centered 425px column at every width, on `bg-navy`. The design uses `#010812` and, from `md`, a 46% brand panel plus a centered form panel.
- Sizes are one step below the design (h1 23px vs 25, sub 13 vs 15, labels 11.5 vs 14, inputs 13.5 vs 15, 1px vs 1.5px borders).
- Login (3 alerts) and Signup (4 alerts) hand-roll alert markup with inline SVGs; `AccountSheet` and `SessionExpiryNoticeDialog` import `LoginErrorAlert` from `app/login`.
- Check Your Email, Too Many Requests, Reset Link Expired and Session Check Failed repeat one shape; Session Check Failed uses its own `<main>`, inline hex colours and `.session-step` CSS in `globals.css`.
- Copy is inline in JSX; `lib/auth/messages.ts` only covers reset, logout and password-input copy. `"/signup"`, `"/login"`, `"/dashboard"` are literals.
- `PasswordUpdatedToast` is an inline banner; the design is a fixed card (mobile: `inset-x-3 top-[68px]`; desktop: right 28px, top 24px, 380px).

## Desired End State

Every Story 0 screen visually matches the design at ~390px and ~1280px. There is no `components/auth/styles.ts`, no inline hex colours in auth components, no auth copy in JSX, and exactly one implementation each of: alert, button, text field, status screen, numbered steps, toast, dialog. Unit tests, e2e specs and axe pass at both widths.

Verify: `npm run lint`, `npx tsc --noEmit`, `npm run test:run`, `npm run test:e2e`, plus axe and screenshot review at 390 and 1280.

### Key Discoveries:

- `--color-ink` maps to `--text` (`#0f1b2a`), so `bg-ink` is the wrong colour; a dedicated `--auth-bg: #010812` token is needed (`app/globals.css`).
- `ui/Button` variants are literal class strings (`components/ui/Button.tsx`); making them read surface variables is the contract the dark surface relies on.
- `FormField`/`TextInput` wire id, `aria-invalid` and `aria-describedby` through context, so the plain auth inputs (login, signup email, forgot) can be rebased on them. `PasswordInput` cannot: it uses `role="alert"` on its error, accepts an external `describedBy` (`REQUIREMENTS_ID`), supports `warning` (invalid without a message) and caller-supplied ids, none of which `FormField` offers. It keeps its own markup and ARIA wiring and reuses only the shared control and label tokens.
- `.auth-page-content:has([data-reset-password-status="checking"]) > .auth-page-glow` in `globals.css` depends on `AuthPageShell` class names and must move to `AuthLayout`.
- `SessionExpiryNoticeDialog` has the same overlay, `role="dialog"`, `useDialogKeyboardNavigation` and heading structure as `AccountSheet`, so it is a clean second `Dialog` consumer.
- Tests pin copy and roles: `__tests__/session/SessionCheckFailed.test.tsx`, `__tests__/forgot-password/ForgotPassword.test.tsx`, `__tests__/reset-password/ResetPassword.test.tsx`, `__tests__/login/LoginForm.test.tsx`, `__tests__/signup/SignupForm.test.tsx`, `__tests__/protected/*`, `__tests__/dashboard/SessionExpiryNoticeDialog.test.tsx`, `__tests__/ui/*`, and `e2e/*.spec.ts` (select by role and name, e.g. "Log In", "Sign Up").

## What We're NOT Doing

- No change to server actions, `lib/auth/*` state/config, `use-countdown`, `useActionState` wiring, cookie and timer logic of the toast, or the resend cooldown value (stays `RESEND_COOLDOWN_SECONDS`; never hard-coded in UI).
- No new routes, no new auth behaviour, no change to redirect or rate-limit logic.
- No light-surface redesign of the rest of the app; light-surface buttons, alerts and fields must render exactly as before.
- No committed screenshot baselines; visual match is reviewed manually.
- No pixel-exact 760px breakpoint; Tailwind `md` (768px) is used.
- No password toggle on the signup form (the design shows Show/Hide on the reset form only).

## Implementation Approach

Mobile first with a single `md:` breakpoint. The dark surface is a `data-surface="dark"` attribute on `AuthLayout` that defines CSS variables (`--surface-*`); `ui/` components read those variables with light defaults, so no `surface` prop is added. Phases are ordered so each one is shippable: foundation (tokens, kit, layout, messages), then the four auth flows with their shared status components, then the protected-side Toast/Dialog/Session Check Failed, then cleanup and verification. Copy assertions in unit and e2e tests are updated in the same phase as the screen that owns the copy.

Adopted decisions (from research): design wording everywhere; `data-surface="dark"`; shared `ui/Toast` and `ui/Dialog`; `#010812` on every auth screen including Session Check Failed; `SessionExpiryNoticeDialog` migrates to `Dialog`; `ui/Button` gets a `danger-outline` variant.

## Critical Implementation Details

- **Light surface must not regress.** Variable-based variants need light-valued defaults on `:root` so every existing consumer renders identically; check `__tests__/ui/*` and the dashboard visually after Phase 1.
- **Heading focus on mount.** Five components focus the h1 in `useEffect`; the shared `useFocusOnMount` / `AuthHeader` focus option must keep focus behaviour identical (focus once on mount, `tabIndex={-1}`).
- **Reset flow data attributes.** Keep `data-reset-password-status` where it is read by the `:has(...)` rule and by tests, and carry the glow selector over to `AuthLayout`.
- **Contrast.** On-dark alert text (`#ffd6d1`, `#ffe2b0`, `#c9f0dc`) and the `#ff8a7e` field-error colour must be re-checked with axe after tokens land; adjust tokens, not per-component colours.

## Phase 1: Foundation: tokens, dark surface, layout, messages

### Overview

Everything the screens depend on, with no screen yet changed except the layout swap. After this phase the four auth pages render inside the new layout with the existing inner markup.

**Before changing `components/ui/`**: capture reference screenshots (390px and 1280px) of `/applications`, `/applications/new` and the dashboard into the scratchpad (not committed). The light-surface manual check compares against them.

### Changes Required:

#### 1. Design tokens

**File**: `app/globals.css`

**Intent**: Add the tokens the design needs that do not exist, and define the dark-surface variables once.

**Contract**: New `--auth-bg: #010812` (and `--color-auth-bg`), brand gradient end `#021a33`, on-dark alert text/tint tokens for danger/warning/success, field-error colour `#ff8a7e` and its tint. A `[data-surface="dark"]` block sets the `--surface-*` variables the `ui/` kit reads (control border/background/text/placeholder, label colour, alert tones, secondary/danger-outline button colours, help text). `:root` supplies light defaults. Do not repoint `--color-ink`. `--auth-label` stays until Phase 4. The `.auth-page-content:has(...)` glow rule is rewritten against `AuthLayout`'s class/data attribute.

#### 2. `ui/` kit reads the surface

**Files**: `components/ui/Button.tsx`, `components/ui/Alert.tsx`, `components/ui/control-styles.ts`, `components/ui/FormField.tsx`, `components/ui/TextInput.tsx`

**Intent**: Make the existing components restyle on a dark ancestor without a new prop, and match the design's field metrics on the dark surface. Light-surface output must stay exactly as it is today.

**Contract**: Variants and tones resolve colours through `--surface-*` variables. `Button` gains `danger-outline` (transparent, danger border/text, used by Log Out in the dialog); `secondary` on dark is outlined white. `FormField` label stays 14px/600, help 13.5px; invalid state uses the surface's error colour and tint. `Alert` public API (`tone`, `title`, `action`, `role`) is unchanged. No trailing-slot or `describedBy`/`alertError` props are added to `FormField`/`TextInput`; `PasswordInput` stays outside `FormField` (see Phase 2 §5). `controlClassName` and the label class are exported so `PasswordInput` can reuse them.

#### 3. Auth messages and paths

**Files**: `lib/auth/messages.ts`, `lib/auth/paths.ts`

**Intent**: Create the home for all auth copy and remove path literals.

**Contract**: Add `LOGIN_MESSAGES`, `SIGNUP_MESSAGES`, `FORGOT_MESSAGES`, `SESSION_ERROR_MESSAGES`, `AUTH_BRAND_MESSAGES` (headline, paragraph, three bullets, footer "Your data is visible only to you" taken from the design's `AUTH_BRAND`); extend `PASSWORD_RESET_MESSAGES` and `LOGOUT_MESSAGES` where the design wording differs (only `LOGOUT_MESSAGES.stillSignedIn` changes, to the design's Log Out Failed wording "We couldn't log you out. You're still logged in on this device. Check your connection and try again."; `unconfirmed`, `configuration` and `unknown` keep their current text because a connectivity hint would be wrong for them). Wording follows the design HTML. Add `SIGNUP_PATH` to `paths.ts`; reuse `DEFAULT_POST_LOGIN_PATH` and the login path constant.

#### 4. Layout components

**Files**: `components/auth/AuthLayout.tsx` (replaces `AuthPageShell.tsx`), `AuthBrandPanel.tsx`, `AuthHeader.tsx`, `AuthFooter.tsx` (+ `AuthLink`), `lib/hooks/use-focus-on-mount.ts`; update `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`; `components/auth/AuthLogo.tsx` adjusted for 40/36 sizes.

**First action**: Per `AGENTS.md`, read the relevant guides under `node_modules/next/dist/docs/` (client components, `next/link`, layout and page props) before writing any code in this change, and note any deprecation that affects the plan.

**Intent**: One frame for all auth screens: `data-surface="dark"`, `--auth-bg`, glow and logo mark on mobile, brand panel plus centered form panel from `md`.

**Contract**: `AuthLayout` keeps `AuthPageShell`'s prop shape (`{ children }`) so the four `page.tsx` files barely change. Brand panel is `aria-hidden="true"` (decorative duplicate copy, so it adds no heading or list to the accessibility tree or to Testing Library role queries), placed before the form panel, `hidden md:flex`, 46% width, gradient `#042c53 → #021a33`, content from `AUTH_BRAND_MESSAGES`. Logo mark and glow are `md:hidden`. The form panel is the page's single `<main>` landmark (no auth page has one today; `SessionCheckFailed` loses its own `<main>` in Phase 3, and the unauthenticated branch of `app/(protected)/layout.tsx` wraps children in a plain `div`, so no second `<main>` appears). Form panel: `max-w-[460px]`, mobile padding 56/24/30, `md:` vertically centered with `md:px-10 md:py-12`; keep `min-h-[100svh]` and `overflow-y-auto`. `AuthHeader` renders logo mark (optional), h1 25px Archivo 700, sub 15px `on-dark-2`, and a `focusHeading` option backed by `useFocusOnMount` (h1 `ref`, `tabIndex={-1}`). `AuthFooter` supports a link row and a `small` mono note variant.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:run`
- Production build succeeds: `npm run build`
- E2E specs pass: `npm run test:e2e`

#### Manual Verification:

- Login, signup, forgot and reset pages show the brand panel on desktop and the single column with logo and glow on mobile
- Light-surface pages (dashboard, application forms) look unchanged against the reference screenshots taken before Phase 1
- Short phone viewport scrolls with the keyboard open
- Next.js guides in `node_modules/next/dist/docs/` read before coding, with any deprecation noted in the plan

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; the corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Auth screens and shared status components

### Overview

Move login, signup, forgot-password and reset-password onto the kit and the new shared pieces, with copy from `messages.ts`, and update the tests that pin old copy.

### Changes Required:

#### 1. Status building blocks

**Files**: `components/auth/AuthStatusScreen.tsx`, `StatusRing.tsx`, `StatusSteps.tsx`, `EmailChip.tsx`, `WaitCard.tsx`, `RequirementList.tsx`; `components/auth/AuthStatusIcons.tsx` kept or folded into `StatusRing`.

**Intent**: One implementation of ring icon, h1, subtext, optional steps, button stack and footnote, plus the small pieces unique to forgot-sent, limited and reset.

**Contract**: `AuthStatusScreen` props: `tone` (`info | warning | danger`), `icon`, `heading`, `description`, optional `children` (steps, chip, wait card), `actions`, `footnote`, `liveRegion?`; focuses its h1 via `useFocusOnMount`. `StatusSteps` is an ordered list with the mono numbered chip (CSS counter or index, no `globals.css` counter classes). `WaitCard` takes the countdown value as a prop; it does not own timing. `RequirementList` keeps the visually hidden "met / not met" text and renders the round chip plus count (`4 / 6`).

#### 2. Login

**Files**: `app/login/LoginForm.tsx`, `LoginFields.tsx`, `LoginAlert.tsx`, `ReturnStrip.tsx` (moved to `components/auth/ReturnStrip.tsx` if reused elsewhere, otherwise restyled in place)

**Intent**: Use `AuthHeader`, `FormField`/`TextInput`, `ui/Alert` (dark), `ui/Button`, `AuthFooter`; return strip gets the dashed sky border and 30px icon tile; both h1/sub variants come from `LOGIN_MESSAGES`.

**Contract**: Accessible names stay `"Log In"`, `"Email"`, `"Password"`, `"Sign Up"` link, `"Forgot password?"`. `LoginErrorAlert` becomes a thin wrapper over `ui/Alert` or is deleted if nothing remains; no protected file may import from `app/login` afterwards.

#### 3. Signup

**Files**: `app/signup/SignupForm.tsx`, `SignupFields.tsx`, `SignupAlerts.tsx`, `PasswordField.tsx`

**Intent**: Same migration; the four alerts use `ui/Alert`; login link uses the login path constant.

**Contract**: No password toggle added. Validation logic in `password-validation.ts` untouched.

#### 4. Forgot password

**Files**: `app/forgot-password/ForgotPasswordForm.tsx`, `CheckYourEmailScreen.tsx`, `TooManyRequestsScreen.tsx`, `ResendLinkForm.tsx`, `ForgotPasswordFlow.tsx`

**Intent**: Form uses the shared header/field/button; Check Your Email and Too Many Requests render through `AuthStatusScreen` with `EmailChip`, `StatusSteps` and `WaitCard`.

**Contract**: Countdown still comes from `use-countdown` and `RESEND_COOLDOWN_SECONDS`; no duration literal in UI. Flow state machine and `useActionState` wiring unchanged.

#### 5. Reset password

**Files**: `app/reset-password/NewPasswordForm.tsx`, `PasswordRequirements.tsx`, `ResetLinkExpiredScreen.tsx`, `ResetPasswordFlow.tsx`, `components/auth/PasswordInput.tsx`

**Intent**: `PasswordInput` keeps its own markup and ARIA wiring but drops `components/auth/styles.ts` in favour of the shared `controlClassName`, the shared label style and the dark-surface variables (Show/Hide toggle 13.5px, same announcements); requirements use `RequirementList`; expired screen uses `AuthStatusScreen`.

**Contract**: `PasswordInput`'s public props (`id`, `describedBy`, `error`, `warning`, `showToggle`, `ref`) and the error `role="alert"` are unchanged; the toggle stays an absolutely positioned button inside a `relative` wrapper with `pr-16` on the input. `data-reset-password-status` attribute preserved; `PASSWORD_INPUT_MESSAGES` behaviour (toggle label, visible announcement) preserved; the class assertions are updated deliberately to the new token classes: `border-auth-danger` on the inputs (`__tests__/components/PasswordInput.test.tsx:60`, `__tests__/reset-password/ResetPassword.test.tsx:94-95`) and `text-auth-danger` on the requirement rows (`ResetPassword.test.tsx:96-97`).

#### 6. Tests

**Files**: `__tests__/login/LoginForm.test.tsx`, `__tests__/signup/SignupForm.test.tsx`, `__tests__/forgot-password/ForgotPassword.test.tsx`, `__tests__/reset-password/ResetPassword.test.tsx`, `e2e/login.spec.ts`, `e2e/signup.spec.ts`, `e2e/forgot-password.spec.ts`, `e2e/reset-password.spec.ts`, `e2e/route-guard.spec.ts` (return-strip text at line 29), `__tests__/components/PasswordInput.test.tsx` (line 60); add `__tests__/auth/AuthStatusScreen.test.tsx` and `StatusSteps`/`RequirementList` tests.

**Intent**: Replace assertions on old copy with the design wording (read from `messages.ts` where practical so copy changes do not churn tests); keep role/name-based selection.

**Contract**: Heading focus on mount, `role="alert"`/`status`, and `aria-describedby` are asserted for the shared screen.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:run`
- E2E auth specs pass: `npm run test:e2e`
- No auth component imports `components/auth/styles.ts` for the migrated screens: `grep -rn "auth/styles" app components`

#### Manual Verification:

- Login (incl. redirected login return strip), signup, forgot, Check Your Email, Too Many Requests, reset form and Reset Link Expired match the design at 390px and 1280px
- Field invalid states, alerts and the requirement list read correctly on dark
- Keyboard-only walk through login → forgot → reset keeps focus on each new h1

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; the corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Protected side: Toast, Dialog, Session Check Failed

### Overview

Bring the screens outside `app/login` etc. onto the shared kit.

### Changes Required:

#### 1. Toast

**Files**: `components/ui/Toast.tsx` (new), `app/(protected)/_components/PasswordUpdatedToast.tsx`

**Intent**: Navy card with green check circle, title, body and close button; `PasswordUpdatedToast` keeps its cookie and timer logic and renders `Toast`.

**Contract**: `Toast` props: `title`, `body`, `dismissLabel`, `onDismiss`; `role="status"`; position `fixed inset-x-3 top-[68px] md:inset-x-auto md:right-7 md:top-6 md:w-[380px]`. Copy stays in `PASSWORD_RESET_MESSAGES.toast`. `__tests__/protected/PasswordUpdatedToast.test.tsx` keeps passing; cookie flow untouched.

#### 2. Dialog

**Files**: `components/ui/Dialog.tsx` (new), `lib/hooks/use-dialog-keyboard-navigation.ts` (moved from `app/(protected)/_components/useDialogKeyboardNavigation.ts`; update imports in `NavDrawer.tsx`, `AccountSheet.tsx`, `SessionExpiryNoticeDialog.tsx` and any test importing it by path), `app/(protected)/_components/AccountSheet.tsx`, `SessionExpiryNoticeDialog.tsx`, `LogoutButton.tsx`

**Intent**: One overlay/sheet implementation (bottom sheet to centered dialog via `items-end md:items-center`) owning `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-busy`, Esc and focus-trap via `useDialogKeyboardNavigation`. AccountSheet gets the design: navy rounded-square avatar, "Account" h3 with mono email, neutral "Logged in on this device" alert, Close and Log Out (`danger-outline`) side by side. SessionExpiryNoticeDialog migrates to `Dialog` with `tone="dark"`, keeping its current navy look (the design HTML has no screen for it, so there is no new visual target).

**Contract**: `Dialog` props: `labelledBy`, `busy`, `tone: "light" | "dark"` (default `light`; `dark` sets `data-surface="dark"` on the dialog container so the `ui/Alert` inside reads the on-dark tones), `firstFocusableRef`, `lastFocusableRef`, `onEscape`, `children`. `Dialog` calls the relocated `useDialogKeyboardNavigation` itself, so `components/ui` never imports from `app/`. Initial focus stays with the consumers (Log Out button / Yes button respectively). In `AccountSheet` the DOM order becomes Close then Log Out (per design), so the trap refs swap with it: `firstFocusableRef` = Close, `lastFocusableRef` = Log Out; initial focus stays on Log Out. Add a Tab / Shift+Tab wrap assertion to `__tests__/protected/AccountMenu.test.tsx`. Both consumers drop the `app/login` `LoginErrorAlert` import in favour of `ui/Alert`. Existing `__tests__/protected/AccountMenu.test.tsx`, `__tests__/protected/useLogout.test.tsx`, `__tests__/dashboard/SessionExpiryNoticeDialog.test.tsx`, `__tests__/dashboard/SessionExpiryNotice.test.tsx` and `e2e/logout.spec.ts`, `e2e/session-expiry.spec.ts`, `e2e/route-guard.spec.ts` (session heading at line 57) must still pass with only deliberate copy updates (Log Out Failed wording).

#### 3. Session Check Failed

**Files**: `app/(protected)/_components/SessionCheckFailed.tsx`, `__tests__/session/SessionCheckFailed.test.tsx`

**Intent**: Render through `AuthLayout` + `AuthStatusScreen` with `StatusSteps`; remove the inline hex colours, its own `<main>`, and use `--auth-bg` like the other auth screens.

**Contract**: Copy moves to `SESSION_ERROR_MESSAGES`; the live-region announcement and h1 focus are preserved; test expectations ("No application data was loaded") follow the messages constants. The `<main>` landmark now comes from `AuthLayout`; `SessionCheckFailed.test.tsx` keeps `getByRole("list")` working because the brand panel is `aria-hidden`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:run`
- E2E specs pass: `npm run test:e2e`
- No protected file imports from `app/login`: `grep -rn "app/login" "app/(protected)"`

#### Manual Verification:

- Password Updated toast shows top-right on desktop and inset on mobile, auto-dismisses and closes via the button
- Account dialog is a bottom sheet on mobile and a centered dialog on desktop; Esc closes it; Tab stays inside; Log Out Failed alert shows
- Session expiry dialog still extends/dismisses and looks consistent
- Session Check Failed matches the design and uses the same background as other auth screens

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; the corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Cleanup and verification

### Overview

Delete what is now dead and verify accessibility and visual match across breakpoints.

### Changes Required:

#### 1. Remove dead code and literals

**Files**: `components/auth/styles.ts` (delete), `app/globals.css` (remove `.session-steps`, `.session-step`, `--auth-label` and `--color-auth-label` if unused), grep for `[font-family:var(--font-work-sans)]` strings in auth files.

**Intent**: Leave a single source of styling and copy.

**Contract**: `grep` for `#f3c47a`, `rgba(184,113,11`, `"/signup"`, `"/login"`, `"/dashboard"` in `app/` and `components/auth` returns only path-constant definitions.

#### 2. Responsive and a11y verification

**Files**: `e2e/helpers/axe.ts` (new, shared `expectNoAxeViolations(page)`), `e2e/auth-responsive.spec.ts` (new, covers the screens reachable by plain navigation), plus axe calls added inside the existing specs that already reach the stateful screens, reusing `@axe-core/playwright` and `e2e/helpers`.

**Intent**: Run axe and basic layout assertions on all 13 screens at 390px and 1280px: no horizontal scroll, brand panel visible only at desktop, inputs and buttons at least 44px high, no axe violations (including colour contrast on dark). Each screen is scanned where an existing spec already reaches it, so no new routes are added.

**Screen reach table** (implementer confirms each mechanism before relying on it; set the viewport per run, since Playwright's default is 1280px):

| Screen | Reached by |
| --- | --- |
| Login, Signup, Forgot password, Reset password (form) | direct navigation in `auth-responsive.spec.ts` |
| Redirected login (return strip) | `route-guard.spec.ts` flow (visit a protected URL while logged out) |
| Check Your Email, Too Many Requests | `forgot-password.spec.ts` (submit; repeat until rate limited) |
| Reset Link Expired | `reset-password.spec.ts` (invalid or used token) |
| Session Check Failed | `route-guard.spec.ts` (the verification-failure setup it already uses) |
| Password Updated toast | `reset-password.spec.ts` (successful reset lands on the dashboard with the toast) |
| Account dialog, Log Out Failed | `logout.spec.ts`; fail the logout request with `page.route` for the failed state |

**Contract**: A screen without an axe scan at both widths is not counted as verified for criterion "no axe violations". Also capture screenshots at both widths into the test output (not committed baselines) for manual comparison against the design HTML.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test:run`
- Full E2E passes, including axe at 390px and 1280px: `npm run test:e2e`
- Production build succeeds: `npm run build`
- Dead-code grep is clean: `grep -rn "auth/styles\|auth-label\|session-step" app components`

#### Manual Verification:

- Side-by-side review of the Playwright screenshots against `supabase/docs/nextjoblog-mvp-screens.html` for all 13 screens at 390px and 1280px
- Dashboard and application pages (light surface) unchanged
- Auth flow behaves identically end to end (sign up, log in, forgot, reset, log out)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before closing the change.

---

## Testing Strategy

### Unit Tests:

- New shared components: `AuthStatusScreen` (focus on mount, tone, role), `StatusSteps`, `RequirementList` (hidden met/not-met text), `Toast`, `Dialog` (labelling, Esc, busy)
- `ui/Button` `danger-outline` variant and `ui/Alert`/`FormField` unchanged light behaviour
- Existing screen tests updated to read copy from `messages.ts`

### Integration Tests:

- Existing e2e auth, logout, session-expiry and reset specs with updated copy
- New `auth-responsive.spec.ts`: axe and layout at 390 and 1280

### Manual Testing Steps:

1. Compare each of the 13 screens to the design HTML at 390px and 1280px
2. Tab through login, forgot and reset to confirm focus order and heading focus
3. Trigger Log Out Failed (go offline) and the session-expiry dialog
4. Confirm the dashboard (light surface) is visually unchanged

## Performance Considerations

None material. The brand panel is static markup; no new client JS beyond the shared components. Keep the Toast and Dialog as client components only where state is needed.

## Migration Notes

No data or route changes. Before writing code, read the relevant guide in `node_modules/next/dist/docs/` per `AGENTS.md` and heed deprecation notices. No Next-specific API changes are expected (client components, `next/link`), but confirm.

## References

- Related research: `context/changes/refresh-access-ui/research.md`
- Change identity: `context/changes/refresh-access-ui/change.md`
- Design source: `supabase/docs/nextjoblog-mvp-screens.html` (Story 0 screens lines 2578–2870, CSS 1949–2340, `AUTH_BRAND` line 4035)
- Existing kit: `components/ui/Button.tsx`, `components/ui/Alert.tsx`, `components/ui/FormField.tsx`, `components/ui/control-styles.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation: tokens, dark surface, layout, messages

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm run test:run`
- [x] 1.4 Production build succeeds: `npm run build`
- [x] 1.8 E2E specs pass: `npm run test:e2e`

#### Manual

- [x] 1.5 Login, signup, forgot and reset pages show the brand panel on desktop and the single column with logo and glow on mobile
- [x] 1.6 Light-surface pages (dashboard, application forms) look unchanged against the reference screenshots taken before Phase 1
- [x] 1.7 Short phone viewport scrolls with the keyboard open
- [x] 1.9 Next.js guides in `node_modules/next/dist/docs/` read before coding, with any deprecation noted in the plan (read link, client components, page/layout conventions: no deprecation affects this phase)

### Phase 2: Auth screens and shared status components

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit` — e8ccf33
- [x] 2.2 Linting passes: `npm run lint` — e8ccf33
- [x] 2.3 Unit tests pass: `npm run test:run` — e8ccf33
- [x] 2.4 E2E auth specs pass: `npm run test:e2e` — deferred to CI per user instruction — e8ccf33
- [x] 2.5 No auth component imports `components/auth/styles.ts` for the migrated screens: `grep -rn "auth/styles" app components` — e8ccf33

#### Manual

- [x] 2.6 Login (incl. redirected login return strip), signup, forgot, Check Your Email, Too Many Requests, reset form and Reset Link Expired match the design at 390px and 1280px — e8ccf33
- [x] 2.7 Field invalid states, alerts and the requirement list read correctly on dark — e8ccf33
- [x] 2.8 Keyboard-only walk through login → forgot → reset keeps focus on each new h1 — e8ccf33

### Phase 3: Protected side: Toast, Dialog, Session Check Failed

#### Automated

- [x] 3.1 Type checking passes: `npx tsc --noEmit`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Unit tests pass: `npm run test:run`
- [x] 3.4 E2E specs pass: `npm run test:e2e` — deferred to CI per user instruction
- [x] 3.5 No protected file imports from `app/login`: `grep -rn "app/login" "app/(protected)"`

#### Manual

- [x] 3.6 Password Updated toast shows top-right on desktop and inset on mobile, auto-dismisses and closes via the button
- [x] 3.7 Account dialog is a bottom sheet on mobile and a centered dialog on desktop; Esc closes it; Tab stays inside; Log Out Failed alert shows
- [x] 3.8 Session expiry dialog still extends/dismisses and looks consistent
- [x] 3.9 Session Check Failed matches the design and uses the same background as other auth screens

### Phase 4: Cleanup and verification

#### Automated

- [ ] 4.1 Type checking passes: `npx tsc --noEmit`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Unit tests pass: `npm run test:run`
- [ ] 4.4 Full E2E passes, including axe at 390px and 1280px: `npm run test:e2e`
- [ ] 4.5 Production build succeeds: `npm run build`
- [ ] 4.6 Dead-code grep is clean: `grep -rn "auth/styles\|auth-label\|session-step" app components`

#### Manual

- [ ] 4.7 Side-by-side review of the Playwright screenshots against `supabase/docs/nextjoblog-mvp-screens.html` for all 13 screens at 390px and 1280px
- [ ] 4.8 Dashboard and application pages (light surface) unchanged
- [ ] 4.9 Auth flow behaves identically end to end (sign up, log in, forgot, reset, log out)
