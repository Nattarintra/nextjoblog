import type { JwtPayload } from "@supabase/auth-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function getSessionLifetimeMs(): number {
  const configuredLifetimeMs = Number(process.env.SESSION_TIMEBOX_MS);

  return Number.isFinite(configuredLifetimeMs) && configuredLifetimeMs > 0
    ? configuredLifetimeMs
    : DEFAULT_SESSION_LIFETIME_MS;
}

export function computeEffectiveSessionExpiresAt(
  baseExpiresAt: number,
  extendedUntil: number | undefined,
): number {
  return Math.max(baseExpiresAt, extendedUntil ?? 0);
}

export function computeNextSessionExpiry(currentEffectiveExpiry: number): number {
  return currentEffectiveExpiry + getSessionLifetimeMs();
}

export function isSessionExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

function getBaseSessionExpiresAt(claims: JwtPayload): number | undefined {
  const firstAmrEntry = claims.amr?.[0];

  if (
    !firstAmrEntry ||
    typeof firstAmrEntry === "string" ||
    typeof firstAmrEntry.timestamp !== "number" ||
    !Number.isFinite(firstAmrEntry.timestamp)
  ) {
    return undefined;
  }

  return firstAmrEntry.timestamp * 1000 + getSessionLifetimeMs();
}

export async function getEffectiveSessionExpiry(): Promise<
  { claims: JwtPayload; effectiveExpiresAt: number } | undefined
> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !data?.claims) {
      return undefined;
    }

    const claims = data.claims;
    const baseExpiresAt = getBaseSessionExpiresAt(claims);

    if (
      baseExpiresAt === undefined ||
      typeof claims.session_id !== "string" ||
      claims.session_id.length === 0
    ) {
      return undefined;
    }

    const { data: extension, error: extensionError } = await supabase
      .from("session_extensions")
      .select("extended_until")
      .eq("session_id", claims.session_id)
      .maybeSingle();

    if (extensionError) {
      throw extensionError;
    }

    const extendedUntil = extension?.extended_until
      ? Date.parse(extension.extended_until)
      : undefined;

    if (extendedUntil !== undefined && !Number.isFinite(extendedUntil)) {
      return undefined;
    }

    return {
      claims,
      effectiveExpiresAt: computeEffectiveSessionExpiresAt(baseExpiresAt, extendedUntil),
    };
  } catch (error) {
    console.error("Unable to read the effective session expiry", error);
    return undefined;
  }
}
