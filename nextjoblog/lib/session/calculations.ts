import { getSessionLifetimeMs } from "./config";

export function computeEffectiveSessionExpiresAt(
  baseExpiresAt: number,
  extendedUntil: number | undefined,
): number {
  return Math.max(baseExpiresAt, extendedUntil ?? 0);
}

export function computeNextSessionExpiry(
  currentEffectiveExpiry: number,
  sessionLifetimeMs = getSessionLifetimeMs(),
): number {
  return currentEffectiveExpiry + sessionLifetimeMs;
}

export function isSessionExpired(
  expiresAt: number,
  now = Date.now(),
): boolean {
  return now >= expiresAt;
}
