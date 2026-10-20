import type { RateLimitPolicy } from "@/lib/auth/password-reset-config";
import {
  MILLISECONDS_PER_SECOND,
} from "@/lib/auth/password-reset-config";
import {
  RateLimiterUnavailableError,
  type RateLimitDecision,
  type RateLimiter,
} from "@/lib/auth/rate-limiter";

type RpcClient = {
  rpc(
    functionName: "consume_rate_limit",
    params: {
      p_scope: string;
      p_key_hash: string;
      p_capacity: number;
      p_refill_interval_seconds: number;
    },
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

type RateLimitRpcRow = {
  allowed: boolean;
  retry_after_seconds: number | null;
};

function isRpcRow(value: unknown): value is RateLimitRpcRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<RateLimitRpcRow>;
  return (
    typeof row.allowed === "boolean" &&
    (row.retry_after_seconds === null ||
      typeof row.retry_after_seconds === "number")
  );
}

export class SupabaseRateLimiter implements RateLimiter {
  constructor(private readonly client: RpcClient) {}

  async consume(
    scope: string,
    keyHash: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision> {
    const { data, error } = await this.client.rpc("consume_rate_limit", {
      p_scope: scope,
      p_key_hash: keyHash,
      p_capacity: policy.capacity,
      p_refill_interval_seconds: Math.max(
        1,
        Math.ceil(policy.refillIntervalMs / MILLISECONDS_PER_SECOND),
      ),
    });

    if (error || !Array.isArray(data) || data.length !== 1 || !isRpcRow(data[0])) {
      throw new RateLimiterUnavailableError();
    }

    const row = data[0];
    if (row.allowed) return { allowed: true };

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, row.retry_after_seconds ?? 1),
    };
  }
}
