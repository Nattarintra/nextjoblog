import { describe, expect, it } from "vitest";

import {
  computeEffectiveSessionExpiresAt,
  computeNextSessionExpiry,
  isSessionExpired,
} from "@/lib/session/calculations";

describe("computeNextSessionExpiry", () => {
  it("adds the configured lifetime to the current expiry", () => {
    expect(computeNextSessionExpiry(100, 60000)).toBe(60100);
  });
});

describe("isSessionExpired", () => {
  it("detects both expired and active timestamps", () => {
    expect(isSessionExpired(1000, 1000)).toBe(true);
    expect(isSessionExpired(1001, 1000)).toBe(false);
  });
});

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
