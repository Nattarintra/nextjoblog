import { describe, expect, it } from "vitest";

import { computeEffectiveSessionExpiresAt } from "@/lib/session";

describe("computeEffectiveSessionExpiresAt", () => {
  it("uses the base expiry when there is no extension", () => {
    expect(computeEffectiveSessionExpiresAt(100, undefined)).toBe(100);
  });

  it("uses an extension when it is later than the base expiry", () => {
    expect(computeEffectiveSessionExpiresAt(100, 200)).toBe(200);
  });

  it("does not shorten the base expiry with an older extension", () => {
    expect(computeEffectiveSessionExpiresAt(200, 100)).toBe(200);
  });
});
