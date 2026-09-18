import type { JwtPayload } from "@supabase/auth-js";
import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { getSessionLifetimeMs } from "./config";
import { computeEffectiveSessionExpiresAt } from "./calculations";
import { getBaseSessionExpiresAt } from "./claims";
import { createSupabaseSessionExtensionStore } from "./extension-store";

export type EffectiveSessionExpiry =
  | { status: "authenticated"; claims: JwtPayload; effectiveExpiresAt: number }
  | { status: "lookup_error"; error: unknown };

async function fetchEffectiveSessionExpiry(): Promise<
  EffectiveSessionExpiry | undefined
> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !data?.claims) {
      return undefined;
    }

    const claims = data.claims;
    const baseExpiresAt = getBaseSessionExpiresAt(
      claims,
      getSessionLifetimeMs(),
    );

    if (
      baseExpiresAt === undefined ||
      typeof claims.session_id !== "string" ||
      claims.session_id.length === 0
    ) {
      return undefined;
    }

    const store = createSupabaseSessionExtensionStore(supabase);
    const extendedUntil = await store.findBySessionId(claims.session_id);

    return {
      status: "authenticated",
      claims,
      effectiveExpiresAt: computeEffectiveSessionExpiresAt(
        baseExpiresAt,
        extendedUntil,
      ),
    };
  } catch (error) {
    console.error("Unable to read the effective session expiry", error);
    return { status: "lookup_error", error };
  }
}

export const getEffectiveSessionExpiry = cache(fetchEffectiveSessionExpiry);
