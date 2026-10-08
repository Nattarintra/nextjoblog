import { describe, expect, it } from "vitest";

import { applyTestSessionOverride } from "@/lib/auth/test-hooks";

const state = {
  status: "authenticated" as const,
  claims: {
    iss: "iss",
    sub: "sub",
    aud: "aud",
    exp: 1,
    iat: 1,
    role: "authenticated",
    aal: "aal1",
    session_id: "session",
  },
  effectiveExpiresAt: 1,
};

describe("applyTestSessionOverride", () => {
  it("fails closed only when the test hook is explicitly enabled", () => {
    expect(applyTestSessionOverride(state, { env: { NODE_ENV: "development", E2E_TEST_HOOKS: "1" }, cookieValue: "fail" })).toEqual({ status: "verification_failed" });
  });

  it.each([
    [{ NODE_ENV: "production", E2E_TEST_HOOKS: "1" }, "fail"],
    [{ NODE_ENV: "development", E2E_TEST_HOOKS: "0" }, "fail"],
    [{ NODE_ENV: "development", E2E_TEST_HOOKS: "1" }, "pass"],
  ])("is inert for env/cookie combination %j", (env, cookieValue) => {
    expect(applyTestSessionOverride(state, { env, cookieValue })).toBe(state);
  });
});
