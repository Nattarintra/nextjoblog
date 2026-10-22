import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "@/lib/auth/in-memory-rate-limiter";

const policy = { capacity: 2, refillIntervalMs: 60_000 } as const;

describe("InMemoryRateLimiter", () => {
  it("allows a bucket's capacity and then returns a retry delay", async () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter({ now: () => now });

    expect(await limiter.consume("scope", "key", policy)).toEqual({ allowed: true });
    expect(await limiter.consume("scope", "key", policy)).toEqual({ allowed: true });
    expect(await limiter.consume("scope", "key", policy)).toEqual({
      allowed: false,
      retryAfterSeconds: 30,
    });

    now = 30_000;
    expect(await limiter.consume("scope", "key", policy)).toEqual({ allowed: true });
  });

  it("keeps scopes and keys in separate buckets and caps refills", async () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter({ now: () => now });

    await limiter.consume("scope", "key", policy);
    now = 120_000;
    expect(await limiter.consume("scope", "key", policy)).toEqual({ allowed: true });
    expect(await limiter.consume("other", "key", policy)).toEqual({ allowed: true });
    expect(await limiter.consume("scope", "other", policy)).toEqual({ allowed: true });
  });

  it("does not move time backwards", async () => {
    let now = 100_000;
    const limiter = new InMemoryRateLimiter({ now: () => now });
    await limiter.consume("scope", "key", policy);
    await limiter.consume("scope", "key", policy);
    now = 0;
    expect(await limiter.consume("scope", "key", policy)).toEqual({
      allowed: false,
      retryAfterSeconds: 30,
    });
  });
});
