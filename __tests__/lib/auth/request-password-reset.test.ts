import { AuthApiError } from "@supabase/auth-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE,
  PASSWORD_RESET_EMAIL_HOURLY_SCOPE,
  PASSWORD_RESET_IP_SCOPE,
} from "@/lib/auth/password-reset-config";
import { RateLimiterUnavailableError, type RateLimiter } from "@/lib/auth/rate-limiter";
import {
  requestPasswordReset,
  PASSWORD_RESET_SECRET_MIN_LENGTH,
} from "@/lib/auth/request-password-reset";

const SECRET = "s".repeat(PASSWORD_RESET_SECRET_MIN_LENGTH);
const EMAIL = "User@Example.com";
const IP = "203.0.113.10";

function createClock() {
  let current = 10_000;
  return {
    now: () => current,
    sleep: vi.fn(async (milliseconds: number) => {
      current += milliseconds;
    }),
  };
}

function createDependencies(overrides: Partial<Parameters<typeof requestPasswordReset>[0]> = {}) {
  const consume = vi.fn<RateLimiter["consume"]>().mockResolvedValue({ allowed: true });
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
  const schedule = vi.fn<(callback: () => Promise<void>) => void>();
  const log = vi.fn();
  const dependencies = {
    limiter: { consume },
    supabase: { auth: { resetPasswordForEmail } },
    schedule,
    enabled: true,
    hashSecret: SECRET,
    siteUrl: "http://127.0.0.1:3000",
    clock: createClock(),
    log,
    ...overrides,
  };
  return { dependencies, consume, resetPasswordForEmail, schedule, log };
}

describe("requestPasswordReset", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns a neutral result and schedules a stateless provider request", async () => {
    const setup = createDependencies();

    await expect(requestPasswordReset(setup.dependencies, { email: EMAIL, clientIp: IP })).resolves.toEqual({
      status: "sent",
    });
    expect(setup.consume).toHaveBeenCalledTimes(3);
    expect(setup.consume.mock.calls.map(([scope]) => scope)).toEqual([
      PASSWORD_RESET_IP_SCOPE,
      PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE,
      PASSWORD_RESET_EMAIL_HOURLY_SCOPE,
    ]);
    expect(setup.schedule).toHaveBeenCalledTimes(1);
    await setup.schedule.mock.calls[0][0]();
    expect(setup.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL.toLowerCase(), {
      redirectTo: "http://127.0.0.1:3000/reset-password",
    });
  });

  it("does not call the provider when the visible IP bucket is denied", async () => {
    const setup = createDependencies();
    setup.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });

    await expect(requestPasswordReset(setup.dependencies, { email: EMAIL, clientIp: IP })).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 42,
    });
    expect(setup.schedule).not.toHaveBeenCalled();
    expect(setup.log).toHaveBeenCalledWith("auth.password_reset.rate_limited");
  });

  it.each([
    "provider-success",
    "provider-unknown-email",
    "provider-429",
    "provider-error",
    "email-cooldown",
    "email-hourly",
    "limiter-failure",
  ])("keeps %s byte-identical to the neutral outcome", async (scenario) => {
    const setup = createDependencies();

    if (scenario === "email-cooldown" || scenario === "email-hourly") {
      setup.consume.mockImplementation(async (scope) =>
        scope === (scenario === "email-cooldown" ? PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE : PASSWORD_RESET_EMAIL_HOURLY_SCOPE)
          ? { allowed: false, retryAfterSeconds: 60 }
          : { allowed: true },
      );
    }
    if (scenario === "limiter-failure") {
      setup.consume.mockRejectedValue(new RateLimiterUnavailableError());
    }
    if (scenario === "provider-429") {
      setup.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: new AuthApiError("Too many requests", 429, "over_email_send_rate_limit"),
      });
    }
    if (scenario === "provider-error") {
      setup.resetPasswordForEmail.mockRejectedValue(new Error("provider unavailable"));
    }

    const result = await requestPasswordReset(setup.dependencies, { email: EMAIL, clientIp: IP });
    expect(result).toEqual({ status: "sent" });
    const shouldScheduleProvider = [
      "provider-success",
      "provider-unknown-email",
      "provider-429",
      "provider-error",
    ].includes(scenario);
    expect(setup.schedule).toHaveBeenCalledTimes(shouldScheduleProvider ? 1 : 0);
    if (shouldScheduleProvider) await setup.schedule.mock.calls[0][0]();
    expect(JSON.stringify(result)).toBe(JSON.stringify({ status: "sent" }));
  });

  it("uses the unknown-IP policy and still keeps the output neutral", async () => {
    const setup = createDependencies();

    await requestPasswordReset(setup.dependencies, { email: EMAIL, clientIp: "unknown" });
    expect(setup.consume.mock.calls[0][0]).toContain("unknown");
  });

  it("fails closed when the secret is missing or the feature is disabled", async () => {
    const missingSecret = createDependencies({ hashSecret: "short" });
    const disabled = createDependencies({ enabled: false });

    await expect(requestPasswordReset(missingSecret.dependencies, { email: EMAIL, clientIp: IP })).resolves.toEqual({ status: "sent" });
    await expect(requestPasswordReset(disabled.dependencies, { email: EMAIL, clientIp: IP })).resolves.toEqual({ status: "sent" });
    expect(missingSecret.consume).not.toHaveBeenCalled();
    expect(disabled.consume).not.toHaveBeenCalled();
    expect(missingSecret.log).toHaveBeenCalledWith(
      "auth.password_reset.configuration_error",
      { code: "missing_or_weak_rate_limit_secret" },
    );
  });

  it("catches deferred provider errors and logs only safe details", async () => {
    const setup = createDependencies();
    setup.resetPasswordForEmail.mockRejectedValue(
      new AuthApiError("provider unavailable", 503, "server_error"),
    );

    await requestPasswordReset(setup.dependencies, { email: EMAIL, clientIp: IP });
    await setup.schedule.mock.calls[0][0]();

    expect(setup.log).toHaveBeenCalledWith("auth.password_reset.provider_error", {
      code: "server_error",
      status: 503,
    });
    expect(JSON.stringify(setup.log.mock.calls)).not.toContain(EMAIL);
  });
});
