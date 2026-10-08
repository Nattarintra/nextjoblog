import type { JwtPayload } from "@supabase/auth-js";
import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { getSessionLifetimeMs } from "./config";
import { computeEffectiveSessionExpiresAt } from "./calculations";
import { getBaseSessionExpiresAt } from "./claims";
import { createSupabaseSessionExtensionStore } from "./extension-store";
import { classifyClaimsResult, classifyThrown } from "@/lib/auth/session-state";

export type EffectiveSessionExpiry =
  | { status: "authenticated"; claims: JwtPayload; effectiveExpiresAt: number }
  | { status: "unauthenticated"; reason: "missing" | "invalid" | "expired" }
  | { status: "verification_failed"; error?: unknown };

async function fetchEffectiveSessionExpiry(): Promise<EffectiveSessionExpiry> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error: claimsError } = await supabase.auth.getClaims();
    const claimsState = classifyClaimsResult({ data, error: claimsError });

    if (claimsState.kind !== "authenticated") {
      return claimsState.kind === "verification_failed"
        ? { status: "verification_failed" }
        : { status: "unauthenticated", reason: claimsState.reason };
    }

    const claims = claimsState.claims as JwtPayload;
    const baseExpiresAt = getBaseSessionExpiresAt(
      claims,
      getSessionLifetimeMs(),
    );

    if (
      baseExpiresAt === undefined ||
      typeof claims.session_id !== "string" ||
      claims.session_id.length === 0
    ) {
      return { status: "unauthenticated", reason: "invalid" };
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
    classifyThrown(error);
    return { status: "verification_failed", error };
  }
}

export const getEffectiveSessionExpiry = cache(fetchEffectiveSessionExpiry);
