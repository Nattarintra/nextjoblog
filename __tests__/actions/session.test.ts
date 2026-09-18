import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServerSupabaseClientMock,
  fromMock,
  getClaimsMock,
  maybeSingleMock,
  upsertMock,
} = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  fromMock: vi.fn(),
  getClaimsMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { extendSession } from "@/app/actions/session";
import { computeNextSessionExpiry } from "@/lib/session";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_ID = "session-id";
const USER_ID = "user-id";
const SESSION_STARTED_AT_SECONDS = 1_800_000_000;

function configureSession(extension: { extended_until: string } | null = null): void {
  maybeSingleMock.mockResolvedValue({ data: extension, error: null });
  upsertMock.mockResolvedValue({ error: null });
  fromMock.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: maybeSingleMock,
    upsert: upsertMock,
  });
  getClaimsMock.mockResolvedValue({
    data: {
      claims: {
        session_id: SESSION_ID,
        sub: USER_ID,
        amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }],
      },
    },
    error: null,
  });
  createServerSupabaseClientMock.mockResolvedValue({
    auth: { getClaims: getClaimsMock },
    from: fromMock,
  });
}

describe("computeNextSessionExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

describe("extendSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("upserts an extension from the current base expiry", async () => {
    configureSession();

    const result = await extendSession(undefined);
    const expectedExpiry = SESSION_STARTED_AT_SECONDS * 1000 + SESSION_MS * 2;

    expect(result).toEqual({ ok: true, extendedUntil: expectedExpiry });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        session_id: SESSION_ID,
        user_id: USER_ID,
        extended_until: new Date(expectedExpiry).toISOString(),
        updated_at: expect.any(String),
      },
      { onConflict: "session_id" },
    );
  });

  it("compounds from the existing extension", async () => {
    const existingExpiry = SESSION_STARTED_AT_SECONDS * 1000 + SESSION_MS * 3;
    configureSession({ extended_until: new Date(existingExpiry).toISOString() });

    const result = await extendSession(undefined);

    expect(result).toEqual({
      ok: true,
      extendedUntil: existingExpiry + SESSION_MS,
    });
  });

  it("rejects an already-expired effective session without upserting", async () => {
    const currentEffectiveExpiry = SESSION_STARTED_AT_SECONDS * 1000 + SESSION_MS * 3;
    configureSession({ extended_until: new Date(currentEffectiveExpiry).toISOString() });
    vi.spyOn(Date, "now").mockReturnValue(currentEffectiveExpiry + 1);

    const result = await extendSession(undefined);

    expect(result).toEqual({
      error: "unknown",
      message: "Unable to extend the session. Please try again.",
    });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it.each([
    "claims retrieval",
    "claims shape",
    "extension query",
    "malformed extension",
    "extension upsert",
  ])("returns an unknown error when %s fails", async (failure) => {
    configureSession();

    if (failure === "claims retrieval") {
      getClaimsMock.mockResolvedValue({ data: null, error: new Error("claims failed") });
    } else if (failure === "claims shape") {
      getClaimsMock.mockResolvedValue({
        data: { claims: { session_id: SESSION_ID, amr: [{ timestamp: SESSION_STARTED_AT_SECONDS }] } },
        error: null,
      });
    } else if (failure === "extension query") {
      maybeSingleMock.mockResolvedValue({ data: null, error: new Error("query failed") });
    } else if (failure === "malformed extension") {
      maybeSingleMock.mockResolvedValue({ data: { extended_until: "invalid" }, error: null });
    } else {
      upsertMock.mockResolvedValue({ error: new Error("upsert failed") });
    }

    await expect(extendSession(undefined)).resolves.toEqual({
      error: "unknown",
      message: "Unable to extend the session. Please try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
