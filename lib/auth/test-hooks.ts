import type { EffectiveSessionExpiry } from "@/lib/session";

export const TEST_SESSION_CHECK_COOKIE = "e2e-session-check";

export function applyTestSessionOverride(
  state: EffectiveSessionExpiry,
  input: {
    env: { NODE_ENV?: string; E2E_TEST_HOOKS?: string };
    cookieValue: string | undefined;
  },
): EffectiveSessionExpiry {
  if (
    input.env.NODE_ENV !== "production" &&
    input.env.E2E_TEST_HOOKS === "1" &&
    input.cookieValue === "fail"
  ) {
    return { status: "verification_failed" };
  }

  return state;
}

export const TEST_LOGOUT_COOKIE = "e2e-logout";

export type TestLogoutOutcome = "fail" | "unconfirmed";

export function applyTestLogoutOverride(input: {
  env: { NODE_ENV?: string; E2E_TEST_HOOKS?: string };
  cookieValue: string | undefined;
}): TestLogoutOutcome | undefined {
  if (input.env.NODE_ENV === "production" || input.env.E2E_TEST_HOOKS !== "1") {
    return undefined;
  }

  return input.cookieValue === "fail" || input.cookieValue === "unconfirmed"
    ? input.cookieValue
    : undefined;
}
