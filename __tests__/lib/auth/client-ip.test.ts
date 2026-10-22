import { describe, expect, it } from "vitest";

import {
  FORWARDED_CLIENT_IP_HEADER,
  getClientIp,
  TEST_CLIENT_IP_HEADER,
  UNKNOWN_CLIENT_IP,
} from "@/lib/auth/client-ip";

describe("getClientIp", () => {
  it("returns a valid Vercel forwarded IP", () => {
    const headers = new Headers({ [FORWARDED_CLIENT_IP_HEADER]: "203.0.113.7" });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("uses the first IP from a forwarded list", () => {
    const headers = new Headers({
      [FORWARDED_CLIENT_IP_HEADER]: "203.0.113.7, 198.51.100.4",
    });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to the dedicated unknown bucket for invalid or missing headers", () => {
    expect(getClientIp(new Headers())).toBe(UNKNOWN_CLIENT_IP);
    expect(
      getClientIp(new Headers({ [FORWARDED_CLIENT_IP_HEADER]: "not-an-ip" })),
    ).toBe(UNKNOWN_CLIENT_IP);
  });

  it("accepts the test IP only when test hooks are enabled", () => {
    const headers = new Headers({ [TEST_CLIENT_IP_HEADER]: "198.51.100.8" });
    expect(getClientIp(headers)).toBe(UNKNOWN_CLIENT_IP);
    expect(getClientIp(headers, { e2eTestHooksEnabled: true })).toBe(
      "198.51.100.8",
    );
  });

  it("does not accept an invalid test IP", () => {
    const headers = new Headers({ [TEST_CLIENT_IP_HEADER]: "invalid" });
    expect(getClientIp(headers, { e2eTestHooksEnabled: true })).toBe(
      UNKNOWN_CLIENT_IP,
    );
  });
});
