import { describe, expect, it } from "vitest";

import { getPasswordValidationError } from "@/app/signup/password-validation";

describe("getPasswordValidationError", () => {
  it("returns an error for passwords under 6 characters", () => {
    expect(getPasswordValidationError("abc")).toBe("At least 6 characters");
  });

  it("returns null for passwords 6 characters or longer", () => {
    expect(getPasswordValidationError("abcdef")).toBeNull();
  });
});
