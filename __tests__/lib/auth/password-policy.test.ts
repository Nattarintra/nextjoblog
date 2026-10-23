import { describe, expect, it } from "vitest";

import {
  isPasswordLongEnough,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HELPER_TEXT,
} from "@/lib/auth/password-policy";

describe("password policy", () => {
  it.each([
    [MIN_PASSWORD_LENGTH - 1, false],
    [MIN_PASSWORD_LENGTH, true],
    [MIN_PASSWORD_LENGTH + 1, true],
  ])("checks a password with %i characters", (length, expected) => {
    expect(isPasswordLongEnough("a".repeat(length))).toBe(expected);
  });

  it("derives the shared helper text from the minimum length", () => {
    expect(PASSWORD_HELPER_TEXT).toBe(`At least ${MIN_PASSWORD_LENGTH} characters`);
  });
});
