import type { RateLimitPolicy } from "@/lib/auth/password-reset-config";

export type RateLimitDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

export interface RateLimiter {
  consume(
    scope: string,
    keyHash: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision>;
}

export type RateLimiterClock = {
  now(): number;
};

export class RateLimiterUnavailableError extends Error {
  constructor(message = "Rate limiter is unavailable") {
    super(message);
    this.name = "RateLimiterUnavailableError";
  }
}
