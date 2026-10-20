import type {
  RateLimitDecision,
  RateLimiter,
  RateLimiterClock,
} from "@/lib/auth/rate-limiter";
import type { RateLimitPolicy } from "@/lib/auth/password-reset-config";
import { MILLISECONDS_PER_SECOND } from "@/lib/auth/password-reset-config";

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const systemClock: RateLimiterClock = { now: () => Date.now() };

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly clock: RateLimiterClock = systemClock) {}

  async consume(
    scope: string,
    keyHash: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision> {
    const now = this.clock.now();
    const bucketKey = `${scope}:${keyHash}`;
    const bucket = this.buckets.get(bucketKey) ?? {
      tokens: policy.capacity,
      updatedAt: now,
    };
    const elapsedMs = Math.max(0, now - bucket.updatedAt);
    const refill = (elapsedMs / policy.refillIntervalMs) * policy.capacity;
    const availableTokens = Math.min(policy.capacity, bucket.tokens + refill);

    if (availableTokens < 1) {
      bucket.tokens = availableTokens;
      bucket.updatedAt = now;
      this.buckets.set(bucketKey, bucket);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            ((1 - availableTokens) * policy.refillIntervalMs) /
              policy.capacity /
              MILLISECONDS_PER_SECOND,
          ),
        ),
      };
    }

    bucket.tokens = availableTokens - 1;
    bucket.updatedAt = now;
    this.buckets.set(bucketKey, bucket);
    return { allowed: true };
  }
}
