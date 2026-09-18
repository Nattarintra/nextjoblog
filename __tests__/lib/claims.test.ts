import { describe, expect, it } from "vitest";
import type { JwtPayload } from "@supabase/auth-js";

import {
  computeBaseSessionExpiry,
  getAuthenticatedClaims,
  getBaseSessionExpiresAt,
} from "@/lib/session/claims";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_STARTED_AT_SECONDS = 1_800_000_000;
const SESSION_ID = "session-id";
const USER_ID = "user-id";

function asClaims(value: unknown): JwtPayload {
  return value as JwtPayload;
}

describe("getBaseSessionExpiresAt", () => {
  it("calculates expiry from the AMR timestamp", () => {
    expect(
      getBaseSessionExpiresAt(
        asClaims({ amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }] }),
        SESSION_LIFETIME_MS,
      ),
    ).toBe(SESSION_STARTED_AT_SECONDS * 1000 + SESSION_LIFETIME_MS);
  });

  it.each<unknown>([
    null,
    { amr: [] },
    { amr: [{ timestamp: "invalid" }] },
  ])("returns undefined for malformed claims: %s", (claims) => {
    expect(getBaseSessionExpiresAt(asClaims(claims ?? {}), SESSION_LIFETIME_MS)).toBeUndefined();
  });
});

describe("computeBaseSessionExpiry", () => {
  it("throws when the claims do not contain a valid AMR timestamp", () => {
    expect(() => computeBaseSessionExpiry(asClaims({}), SESSION_LIFETIME_MS)).toThrow(
      "session_claims_malformed",
    );
  });
});

describe("getAuthenticatedClaims", () => {
  it("returns claims with the required session fields", () => {
    const claims = asClaims({ session_id: SESSION_ID, sub: USER_ID });

    expect(getAuthenticatedClaims(claims)).toBe(claims);
  });

  it.each<unknown>([
    null,
    {},
    { session_id: "", sub: USER_ID },
    { session_id: SESSION_ID, sub: "" },
  ])("throws for claims missing required fields: %s", (claims) => {
    expect(() => getAuthenticatedClaims(claims as JwtPayload | null)).toThrow(
      "session_claims_missing_fields",
    );
  });
});
