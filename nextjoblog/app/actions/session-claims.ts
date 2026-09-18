import type { JwtPayload } from "@supabase/auth-js";

import { SESSION_EXTENSION_ERROR_CODES } from "@/app/actions/session-errors";

export function computeBaseSessionExpiry(
  claims: JwtPayload,
  sessionLifetimeMs: number,
): number {
  const firstAmrEntry = claims.amr?.[0];

  if (
    !firstAmrEntry ||
    typeof firstAmrEntry === "string" ||
    typeof firstAmrEntry.timestamp !== "number" ||
    !Number.isFinite(firstAmrEntry.timestamp)
  ) {
    throw new Error(SESSION_EXTENSION_ERROR_CODES.claimsMalformed);
  }

  return firstAmrEntry.timestamp * 1000 + sessionLifetimeMs;
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
