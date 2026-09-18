import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClientMock, getClaimsMock, fromMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  getClaimsMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  computeEffectiveSessionExpiresAt,
  computeNextSessionExpiry,
  getEffectiveSessionExpiry,
  getSessionLifetimeMs,
  isSessionExpired,
} from "@/lib/session";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_STARTED_AT_SECONDS = 1_800_000_000;
const SESSION_ID = "session-id";

function setExtensionResult(
  extension: { extended_until: string } | null,
  error: unknown = null,
): void {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: extension, error });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: maybeSingleMock,
  };

  fromMock.mockReturnValue(query);
  createServerSupabaseClientMock.mockResolvedValue({
    auth: { getClaims: getClaimsMock },
    from: fromMock,
  });
}

describe("session expiry helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the configured session lifetime", () => {
    vi.stubEnv("SESSION_TIMEBOX_MS", "60000");

    expect(getSessionLifetimeMs()).toBe(60000);
    expect(computeNextSessionExpiry(100)).toBe(60100);
  });

  it.each(["", "0", "-1", "not-a-number"])(
    "uses the default lifetime for an invalid configuration: %s",
    (configuredLifetime) => {
      vi.stubEnv("SESSION_TIMEBOX_MS", configuredLifetime);

      expect(getSessionLifetimeMs()).toBe(SESSION_LIFETIME_MS);
    },
  );

  it("detects both expired and active timestamps", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);

    expect(isSessionExpired(1000)).toBe(true);
    expect(isSessionExpired(1001)).toBe(false);
  });

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

describe("getEffectiveSessionExpiry", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    getClaimsMock.mockReset();
    fromMock.mockReset();
  });

  it("returns the base expiry when no extension exists", async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: {
          session_id: SESSION_ID,
          amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }],
        },
      },
      error: null,
    });
    setExtensionResult(null);

    const result = await getEffectiveSessionExpiry();

    expect(result?.effectiveExpiresAt).toBe(
      SESSION_STARTED_AT_SECONDS * 1000 + SESSION_LIFETIME_MS,
    );
  });

  it("uses a valid extension when it is later than the base expiry", async () => {
    const extendedUntil = "2028-01-01T00:00:00.000Z";
    getClaimsMock.mockResolvedValue({
      data: {
        claims: {
          session_id: SESSION_ID,
          amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }],
        },
      },
      error: null,
    });
    setExtensionResult({ extended_until: extendedUntil });

    const result = await getEffectiveSessionExpiry();

    expect(result?.effectiveExpiresAt).toBe(Date.parse(extendedUntil));
  });

  it.each([
    { claims: null, description: "missing claims" },
    { claims: { session_id: SESSION_ID, amr: [] }, description: "missing AMR" },
    {
      claims: { session_id: SESSION_ID, amr: [{ timestamp: "invalid" }] },
      description: "invalid AMR timestamp",
    },
    {
      claims: { session_id: "", amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }] },
      description: "missing session id",
    },
  ])("returns undefined for $description", async ({ claims }) => {
    getClaimsMock.mockResolvedValue({ data: { claims }, error: null });

    expect(await getEffectiveSessionExpiry()).toBeUndefined();
  });

  it("returns undefined when claims retrieval fails", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: new Error("claims failed") });

    expect(await getEffectiveSessionExpiry()).toBeUndefined();
  });

  it("returns undefined for a malformed extension", async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: {
          session_id: SESSION_ID,
          amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }],
        },
      },
      error: null,
    });
    setExtensionResult({ extended_until: "not-a-date" });

    expect(await getEffectiveSessionExpiry()).toBeUndefined();
  });

  it("returns undefined when the extension query fails", async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: {
          session_id: SESSION_ID,
          amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }],
        },
      },
      error: null,
    });
    setExtensionResult(null, new Error("extension query failed"));

    expect(await getEffectiveSessionExpiry()).toBeUndefined();
  });
});
