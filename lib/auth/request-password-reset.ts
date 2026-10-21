import { describeAuthError, type AuthLogDetails } from "@/lib/auth/error-details";
import {
  MIN_RESPONSE_MS,
  PASSWORD_RESET_EMAIL_COOLDOWN_POLICY,
  PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE,
  PASSWORD_RESET_EMAIL_HOURLY_POLICY,
  PASSWORD_RESET_EMAIL_HOURLY_SCOPE,
  PASSWORD_RESET_IP_POLICY,
  PASSWORD_RESET_IP_SCOPE,
  PASSWORD_RESET_UNKNOWN_IP_POLICY,
  PASSWORD_RESET_UNKNOWN_IP_SCOPE,
} from "@/lib/auth/password-reset-config";
import { hashRateLimitKey } from "@/lib/auth/rate-limit-key";
import { RateLimiterUnavailableError, type RateLimiter } from "@/lib/auth/rate-limiter";
import { normalizeEmail } from "@/lib/auth/email";
import { withMinimumDuration, type DurationClock } from "@/lib/auth/with-minimum-duration";

const PASSWORD_RESET_EVENT = {
  configuration: "auth.password_reset.configuration_error",
  limiterError: "auth.password_reset.rate_limiter_error",
  providerError: "auth.password_reset.provider_error",
  silentlyLimited: "auth.password_reset.silently_rate_limited",
} as const;

export const PASSWORD_RESET_SECRET_MIN_LENGTH = 32;
export const PASSWORD_RESET_PROVIDER_TIMEOUT_MS = 5_000;

type PasswordResetSupabaseClient = {
  auth: {
    resetPasswordForEmail(
      email: string,
      options: { redirectTo: string },
    ): Promise<{ data: unknown; error: unknown }>;
  };
};

type ResetRequestResult =
  | { readonly status: "sent" }
  | { readonly status: "rate_limited"; readonly retryAfterSeconds: number };

type ResetRequestDecision = {
  readonly result: ResetRequestResult;
  readonly shouldScheduleProvider: boolean;
};

type RequestPasswordResetDependencies = {
  limiter: RateLimiter;
  supabase: PasswordResetSupabaseClient;
  schedule(callback: () => Promise<void>): void;
  enabled: boolean;
  hashSecret: string;
  siteUrl: string;
  clock: DurationClock;
  log(event: string, details?: AuthLogDetails): void;
};

type RequestPasswordResetInput = {
  email: string;
  clientIp: string;
};

function neutralResult(): ResetRequestResult {
  return { status: "sent" };
}

function isValidSecret(secret: string): boolean {
  return secret.length >= PASSWORD_RESET_SECRET_MIN_LENGTH;
}

function isDenied(
  decision: Awaited<ReturnType<RateLimiter["consume"]>>,
): decision is { readonly allowed: false; readonly retryAfterSeconds: number } {
  return !decision.allowed;
}

function createRecoveryRedirect(siteUrl: string): string {
  return new URL("/reset-password", siteUrl).toString();
}

async function runProviderCall(
  dependencies: RequestPasswordResetDependencies,
  email: string,
): Promise<void> {
  const providerCall = dependencies.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: createRecoveryRedirect(dependencies.siteUrl),
  });
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Password reset provider timed out")),
      PASSWORD_RESET_PROVIDER_TIMEOUT_MS,
    );
  });

  try {
    const { error } = await Promise.race([providerCall, timeout]);
    if (error) {
      dependencies.log(PASSWORD_RESET_EVENT.providerError, describeAuthError(error));
    }
  } catch (error) {
    dependencies.log(PASSWORD_RESET_EVENT.providerError, describeAuthError(error));
  }
}

export async function requestPasswordReset(
  dependencies: RequestPasswordResetDependencies,
  input: RequestPasswordResetInput,
): Promise<ResetRequestResult> {
  const email = normalizeEmail(input.email);

  if (!dependencies.enabled || !isValidSecret(dependencies.hashSecret)) {
    if (dependencies.enabled && !isValidSecret(dependencies.hashSecret)) {
      dependencies.log(PASSWORD_RESET_EVENT.configuration, {
        code: "missing_or_weak_rate_limit_secret",
      });
    }
    return neutralResult();
  }

  const result = await withMinimumDuration(async () => {
    try {
      const ipScope =
        input.clientIp === "unknown"
          ? PASSWORD_RESET_UNKNOWN_IP_SCOPE
          : PASSWORD_RESET_IP_SCOPE;
      const ipPolicy =
        input.clientIp === "unknown"
          ? PASSWORD_RESET_UNKNOWN_IP_POLICY
          : PASSWORD_RESET_IP_POLICY;
      const ipDecision = await dependencies.limiter.consume(
        ipScope,
        hashRateLimitKey(ipScope, input.clientIp, dependencies.hashSecret),
        ipPolicy,
      );

      if (isDenied(ipDecision)) {
        return {
          result: {
            status: "rate_limited",
            retryAfterSeconds: ipDecision.retryAfterSeconds,
          },
          shouldScheduleProvider: false,
        } satisfies ResetRequestDecision;
      }

      const cooldownDecision = await dependencies.limiter.consume(
        PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE,
        hashRateLimitKey(
          PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE,
          email,
          dependencies.hashSecret,
        ),
        PASSWORD_RESET_EMAIL_COOLDOWN_POLICY,
      );

      if (isDenied(cooldownDecision)) {
        dependencies.log(PASSWORD_RESET_EVENT.silentlyLimited);
        return {
          result: neutralResult(),
          shouldScheduleProvider: false,
        } satisfies ResetRequestDecision;
      }

      const hourlyDecision = await dependencies.limiter.consume(
        PASSWORD_RESET_EMAIL_HOURLY_SCOPE,
        hashRateLimitKey(
          PASSWORD_RESET_EMAIL_HOURLY_SCOPE,
          email,
          dependencies.hashSecret,
        ),
        PASSWORD_RESET_EMAIL_HOURLY_POLICY,
      );

      if (isDenied(hourlyDecision)) {
        dependencies.log(PASSWORD_RESET_EVENT.silentlyLimited);
        return {
          result: neutralResult(),
          shouldScheduleProvider: false,
        } satisfies ResetRequestDecision;
      }

      return {
        result: neutralResult(),
        shouldScheduleProvider: true,
      } satisfies ResetRequestDecision;
    } catch (error) {
      if (error instanceof RateLimiterUnavailableError) {
        dependencies.log(PASSWORD_RESET_EVENT.limiterError);
        return {
          result: neutralResult(),
          shouldScheduleProvider: false,
        } satisfies ResetRequestDecision;
      }
      dependencies.log(PASSWORD_RESET_EVENT.limiterError, describeAuthError(error));
      return {
        result: neutralResult(),
        shouldScheduleProvider: false,
      } satisfies ResetRequestDecision;
    }
  }, MIN_RESPONSE_MS, dependencies.clock);

  if (result.result.status === "rate_limited" || !result.shouldScheduleProvider) {
    return result.result;
  }

  dependencies.schedule(() => runProviderCall(dependencies, email));
  return result.result;
}
