const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function getSessionLifetimeMs(): number {
  const configuredLifetimeMs = Number(process.env.SESSION_TIMEBOX_MS);

  return Number.isFinite(configuredLifetimeMs) && configuredLifetimeMs > 0
    ? configuredLifetimeMs
    : DEFAULT_SESSION_LIFETIME_MS;
}
