import { describe, expect, it, vi } from "vitest";

import { SupabaseRateLimiter } from "@/lib/auth/supabase-rate-limiter";
import { RateLimiterUnavailableError } from "@/lib/auth/rate-limiter";

const policy = { capacity: 5, refillIntervalMs: 60_000 } as const;

describe("SupabaseRateLimiter", () => {
  it("passes the policy to the RPC and maps an allowed row", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, retry_after_seconds: 0 }],
      error: null,
    });
    const limiter = new SupabaseRateLimiter({ rpc });

    await expect(limiter.consume("scope", "hash", policy)).resolves.toEqual({
      allowed: true,
    });
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_scope: "scope",
      p_key_hash: "hash",
      p_capacity: 5,
      p_refill_interval_seconds: 60,
    });
  });

  it("maps a denied row and protects against a zero retry value", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: false, retry_after_seconds: 12 }],
      error: null,
    });
    const limiter = new SupabaseRateLimiter({ rpc });

    await expect(limiter.consume("scope", "hash", policy)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 12,
    });
  });

  it.each([
    { data: null, error: new Error("rpc failed") },
    { data: [], error: null },
    { data: [{ allowed: "yes" }], error: null },
  ])("throws a typed error for an unusable RPC response", async (response) => {
    const limiter = new SupabaseRateLimiter({
      rpc: vi.fn().mockResolvedValue(response),
    });

    await expect(limiter.consume("scope", "hash", policy)).rejects.toBeInstanceOf(
      RateLimiterUnavailableError,
    );
  });

  it("converts a rejected RPC into a typed unavailable error", async () => {
    const limiter = new SupabaseRateLimiter({
      rpc: vi.fn().mockRejectedValue(new Error("network failure")),
    });

    await expect(limiter.consume("scope", "hash", policy)).rejects.toBeInstanceOf(
      RateLimiterUnavailableError,
    );
  });
});
