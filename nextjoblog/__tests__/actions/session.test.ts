import { describe, expect, it } from "vitest";

import { computeNextSessionExpiry } from "@/lib/session";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

describe("computeNextSessionExpiry", () => {
  it("extends a base expiry by one session period", () => {
    const baseExpiry = Date.UTC(2026, 0, 1);

    expect(computeNextSessionExpiry(baseExpiry)).toBe(baseExpiry + SESSION_MS);
  });

  it("compounds from the latest extended expiry", () => {
    const latestExtendedExpiry = Date.UTC(2026, 1, 1);

    expect(computeNextSessionExpiry(latestExtendedExpiry)).toBe(
      latestExtendedExpiry + SESSION_MS,
    );
  });

  it("does not depend on whether the base expiry has already passed", () => {
    const unexpiredExtension = Date.UTC(2026, 2, 1);

    expect(computeNextSessionExpiry(unexpiredExtension)).toBe(
      unexpiredExtension + SESSION_MS,
    );
  });
});
