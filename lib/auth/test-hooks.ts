import type { EffectiveSessionExpiry } from "@/lib/session";

type HookEnv = { NODE_ENV?: string; E2E_TEST_HOOKS?: string };

// Single gate for every E2E hook: inert in production and unless opted in.
export function isE2eHooksEnabled(env: HookEnv): boolean {
  return env.NODE_ENV !== "production" && env.E2E_TEST_HOOKS === "1";
}

export const TEST_SESSION_CHECK_COOKIE = "e2e-session-check";

export function applyTestSessionOverride(
  state: EffectiveSessionExpiry,
  input: {
    env: HookEnv;
    cookieValue: string | undefined;
  },
): EffectiveSessionExpiry {
  if (isE2eHooksEnabled(input.env) && input.cookieValue === "fail") {
    return { status: "verification_failed" };
  }

  return state;
}

export const TEST_LOGOUT_COOKIE = "e2e-logout";

export type TestLogoutOutcome = "fail" | "unconfirmed";

export function applyTestLogoutOverride(input: {
  env: HookEnv;
  cookieValue: string | undefined;
}): TestLogoutOutcome | undefined {
  if (!isE2eHooksEnabled(input.env)) return undefined;

  return input.cookieValue === "fail" || input.cookieValue === "unconfirmed"
    ? input.cookieValue
    : undefined;
}
