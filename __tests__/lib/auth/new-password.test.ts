import { describe, expect, it } from "vitest";

import {
  getPasswordRequirementState,
  NEW_PASSWORD_RULES,
  validateNewPassword,
} from "@/lib/auth/new-password";

describe("new password validation", () => {
  it.each([
    [{ password: "short", confirmation: "short" }, "too_short"],
    [{ password: "long-enough", confirmation: "different" }, "mismatch"],
    [{ password: "long-enough", confirmation: "long-enough" }, "ok"],
  ])("validates %j", (input, expected) => {
    expect(validateNewPassword(input)).toBe(expected);
  });

  it("exports data-driven requirement rules", () => {
    expect(NEW_PASSWORD_RULES.map(({ id, messageKey }) => ({ id, messageKey }))).toEqual([
      { id: "length", messageKey: "length" },
      { id: "match", messageKey: "match" },
    ]);
    expect(getPasswordRequirementState({ password: "short", confirmation: "different" })).toEqual([
      { id: "length", met: false },
      { id: "match", met: false },
    ]);
  });
});
