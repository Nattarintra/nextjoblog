import type { JwtPayload } from "@supabase/auth-js";

import { SESSION_EXTENSION_ERROR_CODES } from "./errors";

export function getBaseSessionExpiresAt(
  claims: JwtPayload,
  sessionLifetimeMs: number,
): number | undefined {
  // Token refreshes add or update AMR entries, so a single entry's timestamp can
  // move later within one session. The earliest timestamp is the original
  // sign-in and stays fixed for the life of the session.
  const timestamps = (claims.amr ?? []).flatMap((entry) =>
    typeof entry !== "string" && typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? [entry.timestamp]
      : [],
  );

  if (timestamps.length === 0) {
    return undefined;
  }

  return Math.min(...timestamps) * 1000 + sessionLifetimeMs;
}

export function computeBaseSessionExpiry(
  claims: JwtPayload,
  sessionLifetimeMs: number,
): number {
  const baseExpiry = getBaseSessionExpiresAt(claims, sessionLifetimeMs);

  if (baseExpiry === undefined) {
    throw new Error(SESSION_EXTENSION_ERROR_CODES.claimsMalformed);
  }

  return baseExpiry;
}

export function getAuthenticatedClaims(
  claims: JwtPayload | null | undefined,
): JwtPayload {
  if (
    !claims ||
    typeof claims.session_id !== "string" ||
    claims.session_id.length === 0 ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0
  ) {
    throw new Error(SESSION_EXTENSION_ERROR_CODES.claimsMissingFields);
  }

  return claims;
}
