import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail } from "@/lib/auth/email";

describe("email helpers", () => {
  it("normalizes whitespace, compatibility characters and casing", () => {
    expect(normalizeEmail("  Ｕｓｅｒ@Example.COM  ")).toBe("user@example.com");
  });

  it.each(["user@example.com", "user+tag@example.co.uk"])(
    "accepts %s",
    (email) => expect(isValidEmail(email)).toBe(true),
  );

  it.each(["", "user", "user@", "user@example", "user example@example.com"])(
    "rejects %s",
    (email) => expect(isValidEmail(email)).toBe(false),
  );
});
