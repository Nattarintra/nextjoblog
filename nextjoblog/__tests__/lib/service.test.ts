import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClientMock, getClaimsMock, fromMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  getClaimsMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { getEffectiveSessionExpiry } from "@/lib/session/service";

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

function setValidClaims(): void {
  getClaimsMock.mockResolvedValue({
    data: {
      claims: {
        session_id: SESSION_ID,
        amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }],
      },
    },
    error: null,
  });
}

describe("getEffectiveSessionExpiry", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    getClaimsMock.mockReset();
    fromMock.mockReset();
  });

  it("returns the base expiry when no extension exists", async () => {
    setValidClaims();
    setExtensionResult(null);

    const result = await getEffectiveSessionExpiry();

    expect(result?.status).toBe("authenticated");
    if (result?.status !== "authenticated") throw new Error("Expected an authenticated result");
    expect(result.effectiveExpiresAt).toBe(
      SESSION_STARTED_AT_SECONDS * 1000 + SESSION_LIFETIME_MS,
    );
  });

  it("uses a valid extension when it is later than the base expiry", async () => {
    const extendedUntil = "2028-01-01T00:00:00.000Z";
    setValidClaims();
    setExtensionResult({ extended_until: extendedUntil });

    const result = await getEffectiveSessionExpiry();

    expect(result?.status).toBe("authenticated");
    if (result?.status !== "authenticated") throw new Error("Expected an authenticated result");
    expect(result.effectiveExpiresAt).toBe(Date.parse(extendedUntil));
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

  it("returns a lookup error when the extension is malformed", async () => {
    setValidClaims();
    setExtensionResult({ extended_until: "not-a-date" });

    const result = await getEffectiveSessionExpiry();

    expect(result?.status).toBe("lookup_error");
  });

  it("returns a lookup error when the extension query fails", async () => {
    setValidClaims();
    setExtensionResult(null, new Error("extension query failed"));

    const result = await getEffectiveSessionExpiry();

    expect(result?.status).toBe("lookup_error");
  });
});
