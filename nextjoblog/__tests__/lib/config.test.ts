import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionLifetimeMs } from "@/lib/session/config";

const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

describe("getSessionLifetimeMs", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured session lifetime", () => {
    vi.stubEnv("SESSION_TIMEBOX_MS", "60000");

    expect(getSessionLifetimeMs()).toBe(60000);
  });

  it.each(["", "0", "-1", "not-a-number"])(
    "uses the default lifetime for an invalid configuration: %s",
    (configuredLifetime) => {
      vi.stubEnv("SESSION_TIMEBOX_MS", configuredLifetime);

      expect(getSessionLifetimeMs()).toBe(DEFAULT_SESSION_LIFETIME_MS);
    },
  );
});
