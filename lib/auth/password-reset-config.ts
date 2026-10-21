export const MILLISECONDS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;

export const PASSWORD_RESET_IP_SCOPE = "password_reset_ip" as const;
export const PASSWORD_RESET_UNKNOWN_IP_SCOPE = "password_reset_unknown_ip" as const;
export const PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE =
  "password_reset_email_cooldown" as const;
export const PASSWORD_RESET_EMAIL_HOURLY_SCOPE =
  "password_reset_email_hourly" as const;

export const PASSWORD_RESET_SCOPES = [
  PASSWORD_RESET_IP_SCOPE,
  PASSWORD_RESET_UNKNOWN_IP_SCOPE,
  PASSWORD_RESET_EMAIL_COOLDOWN_SCOPE,
  PASSWORD_RESET_EMAIL_HOURLY_SCOPE,
] as const;

export type PasswordResetRateLimitScope = (typeof PASSWORD_RESET_SCOPES)[number];

export type RateLimitPolicy = {
  readonly capacity: number;
  readonly refillIntervalMs: number;
};

const ONE_HOUR_IN_MILLISECONDS =
  SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MILLISECONDS_PER_SECOND;

export const PASSWORD_RESET_IP_POLICY: RateLimitPolicy = {
  capacity: 5,
  refillIntervalMs: ONE_HOUR_IN_MILLISECONDS,
};

export const PASSWORD_RESET_UNKNOWN_IP_POLICY: RateLimitPolicy = {
  capacity: 20,
  refillIntervalMs: ONE_HOUR_IN_MILLISECONDS,
};

export const PASSWORD_RESET_EMAIL_COOLDOWN_POLICY: RateLimitPolicy = {
  capacity: 1,
  refillIntervalMs: SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
};

export const PASSWORD_RESET_EMAIL_HOURLY_POLICY: RateLimitPolicy = {
  capacity: 5,
  refillIntervalMs: ONE_HOUR_IN_MILLISECONDS,
};

export const MIN_RESPONSE_MS = 100;
export const PASSWORD_RESET_LIMITER_TIMEOUT_MS = 2_000;
export const RESEND_COOLDOWN_SECONDS = SECONDS_PER_MINUTE;
export const COUNTDOWN_TICK_MS = MILLISECONDS_PER_SECOND;
