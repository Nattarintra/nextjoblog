import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_EXTENSION_ERROR_CODES } from "@/lib/session/errors";
import { createSupabaseSessionExtensionStore } from "@/lib/session/extension-store";

const rpcMock = vi.fn();
const supabase = { rpc: rpcMock } as never;

describe("createSupabaseSessionExtensionStore.compareAndSet", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns the server-confirmed expiry and sends only server-safe arguments", async () => {
    rpcMock.mockResolvedValue({
      data: [{ result: "success", extended_until: "2027-01-01T00:00:00.000Z" }],
      error: null,
    });

    const result = await createSupabaseSessionExtensionStore(supabase).compareAndSet({
      sessionId: "session-id",
      expectedEffectiveExpiresAt: Date.parse("2026-12-02T00:00:00.000Z"),
    });

    expect(result).toEqual({ status: "success", extendedUntil: Date.parse("2027-01-01T00:00:00.000Z") });
    expect(rpcMock).toHaveBeenCalledWith("extend_session_if_current", {
      p_session_id: "session-id",
      p_expected_extended_until: null,
      p_expected_effective_expires_at: "2026-12-02T00:00:00.000Z",
    });
  });

  it("maps a stale cycle to a conflict", async () => {
    rpcMock.mockResolvedValue({ data: [{ result: "conflict", extended_until: null }], error: null });

    await expect(
      createSupabaseSessionExtensionStore(supabase).compareAndSet({
        sessionId: "session-id",
        expectedEffectiveExpiresAt: Date.parse("2026-12-02T00:00:00.000Z"),
        expectedExtendedUntil: Date.parse("2026-12-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "conflict" });
  });

  it.each([
    { data: [], label: "empty result" },
    { data: [{ result: "success", extended_until: null }], label: "missing expiry" },
    { data: [{ result: "success", extended_until: "not-a-date" }], label: "invalid expiry" },
  ])("rejects a malformed RPC result ($label)", async ({ data }) => {
    rpcMock.mockResolvedValue({ data, error: null });

    await expect(
      createSupabaseSessionExtensionStore(supabase).compareAndSet({
        sessionId: "session-id",
        expectedEffectiveExpiresAt: Date.now(),
      }),
    ).rejects.toThrow(SESSION_EXTENSION_ERROR_CODES.extensionRpcMalformed);
  });

  it("maps RPC transport failures without leaking the database error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("permission details") });

    await expect(
      createSupabaseSessionExtensionStore(supabase).compareAndSet({
        sessionId: "session-id",
        expectedEffectiveExpiresAt: Date.now(),
      }),
    ).rejects.toThrow(SESSION_EXTENSION_ERROR_CODES.extensionRpcFailed);
  });
});
