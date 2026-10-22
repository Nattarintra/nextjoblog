import { describe, expect, it } from "vitest";

import { hashRateLimitKey } from "@/lib/auth/rate-limit-key";

describe("hashRateLimitKey", () => {
  it("returns a deterministic SHA-256 HMAC hex digest", () => {
    const first = hashRateLimitKey("scope", "value", "secret");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRateLimitKey("scope", "value", "secret")).toBe(first);
    expect(hashRateLimitKey("scope", "other", "secret")).not.toBe(first);
    expect(hashRateLimitKey("other", "value", "secret")).not.toBe(first);
  });
});
