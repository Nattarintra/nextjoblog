import { describe, expect, it, vi } from "vitest";

import { createExpiredSessionCleanup } from "@/lib/auth/expired-session";
import { EXPIRED_SESSION_LOG_EVENT } from "@/lib/auth/messages";
import { SupabaseConfigError } from "@/lib/supabase/config";

function setup() {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const createClient = vi.fn().mockResolvedValue({ auth: { signOut } });
  const log = vi.fn();
  const cleanup = createExpiredSessionCleanup({ createClient, log });
  return { cleanup, createClient, log, signOut };
}

describe("createExpiredSessionCleanup", () => {
  it("signs out the current session once with local scope", async () => {
    const { cleanup, signOut, log } = setup();

    await expect(cleanup()).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(log).not.toHaveBeenCalled();
  });

  it("logs only safe provider details for a returned error", async () => {
    const { cleanup, signOut, log } = setup();
    signOut.mockResolvedValue({
      error: {
        code: "provider_down",
        status: 503,
        message: "secret",
        stack: "secret stack",
      },
    });

    await expect(cleanup()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(EXPIRED_SESSION_LOG_EVENT.providerError, {
      code: "provider_down",
      status: 503,
    });
    expect(log.mock.calls[0]?.[1]).toEqual({ code: "provider_down", status: 503 });
  });

  it("logs an unexpected event without details when signOut rejects", async () => {
    const { cleanup, signOut, log } = setup();
    signOut.mockRejectedValue(new Error("secret"));

    await expect(cleanup()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(EXPIRED_SESSION_LOG_EVENT.unexpected);
  });

  it("logs the configuration reason when client creation fails", async () => {
    const { cleanup, createClient, log } = setup();
    createClient.mockRejectedValue(new SupabaseConfigError("missing_url"));

    await expect(cleanup()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(EXPIRED_SESSION_LOG_EVENT.configuration, {
      code: "missing_url",
    });
  });

  it("never rejects for unknown thrown values", async () => {
    const { cleanup, createClient, log } = setup();
    createClient.mockRejectedValue("not an Error");

    await expect(cleanup()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(EXPIRED_SESSION_LOG_EVENT.unexpected);
  });

  it("continues after cleanup times out", async () => {
    vi.useFakeTimers();
    const { cleanup, createClient, log } = setup();
    createClient.mockReturnValue(new Promise(() => undefined));

    const result = cleanup();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(result).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(EXPIRED_SESSION_LOG_EVENT.unexpected);
    vi.useRealTimers();
  });
});
