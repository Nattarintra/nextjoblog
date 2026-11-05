import { describe, expect, it } from "vitest";

import {
  parseRecoveryFragment,
  readRecoveryEmail,
} from "@/lib/auth/recovery-fragment";

const tokens = {
  accessToken: "header.eyJlbWFpbCI6Im5hdHRhQGV4YW1wbGUuY29tIn0.signature",
  refreshToken: "refresh-token",
};

describe("parseRecoveryFragment", () => {
  it.each([
    [
      `#access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&type=recovery`,
      { kind: "tokens", ...tokens },
    ],
    ["#error=access_denied&error_code=otp_expired", { kind: "error", code: "otp_expired" }],
    ["", { kind: "none" }],
    ["#access_token=only-one-token&type=recovery", { kind: "none" }],
    [
      `#access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&type=signup`,
      { kind: "none" },
    ],
    ["#access_token=a&refresh_token=b&type=recovery&extra=value", { kind: "tokens", accessToken: "a", refreshToken: "b" }],
  ])("parses %s", (hash, expected) => {
    expect(parseRecoveryFragment(hash)).toEqual(expected);
  });
});

describe("readRecoveryEmail", () => {
  it("reads a valid email claim", () => {
    expect(readRecoveryEmail(tokens.accessToken)).toBe("natta@example.com");
  });

  it.each([
    "header.eyJzdWIiOiIxIn0.signature",
    "not-a-jwt",
    "header.%%%signature",
  ])("returns undefined for %s", (token) => {
    expect(readRecoveryEmail(token)).toBeUndefined();
  });
});
