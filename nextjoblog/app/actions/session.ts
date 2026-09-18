"use server";

import type { JwtPayload } from "@supabase/auth-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { computeNextSessionExpiry, getSessionLifetimeMs } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ExtendSessionState =
  | undefined
  | { ok: true; extendedUntil: number }
  | { error: "unknown"; message: string };

type SessionExtension = {
  extended_until: string;
};

export interface SessionExtensionStore {
  findBySessionId(sessionId: string): Promise<SessionExtension | null>;
  upsert(extension: {
    sessionId: string;
    userId: string;
    extendedUntil: number;
  }): Promise<void>;
}

function computeBaseSessionExpiry(
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
    throw new Error("The current session claims are malformed.");
  }

  return firstAmrEntry.timestamp * 1000 + sessionLifetimeMs;
}

function computeEffectiveExpiry(
  baseExpiry: number,
  extension: SessionExtension | null,
): number {
  if (!extension) {
    return baseExpiry;
  }

  const extendedUntil = Date.parse(extension.extended_until);

  if (!Number.isFinite(extendedUntil)) {
    throw new Error("The current session extension is malformed.");
  }

  return Math.max(baseExpiry, extendedUntil);
}

function getAuthenticatedClaims(claims: JwtPayload | null | undefined): JwtPayload {
  if (
    !claims ||
    typeof claims.session_id !== "string" ||
    claims.session_id.length === 0 ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0
  ) {
    throw new Error("The current session claims are missing required fields.");
  }

  return claims;
}

function createSupabaseSessionExtensionStore(
  supabase: SupabaseClient,
): SessionExtensionStore {
  return {
    async findBySessionId(sessionId) {
      const { data, error } = await supabase
        .from("session_extensions")
        .select("extended_until")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as SessionExtension | null;
    },

    async upsert({ sessionId, userId, extendedUntil }) {
      const now = new Date().toISOString();
      const { error } = await supabase.from("session_extensions").upsert(
        {
          session_id: sessionId,
          user_id: userId,
          extended_until: new Date(extendedUntil).toISOString(),
          updated_at: now,
        },
        { onConflict: "session_id" },
      );

      if (error) {
        throw error;
      }
    },
  };
}

function failure(message: string, error: unknown): ExtendSessionState {
  console.error("Session extension failed", error);
  return { error: "unknown", message };
}

export async function extendSession(
  _state: ExtendSessionState,
): Promise<ExtendSessionState> {
  void _state;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error) {
      throw error;
    }

    const claims = getAuthenticatedClaims(data?.claims);
    const store = createSupabaseSessionExtensionStore(supabase);
    const extension = await store.findBySessionId(claims.session_id);
    const baseExpiry = computeBaseSessionExpiry(
      claims,
      getSessionLifetimeMs(),
    );
    const currentEffectiveExpiry = computeEffectiveExpiry(baseExpiry, extension);
    const extendedUntil = computeNextSessionExpiry(currentEffectiveExpiry);

    await store.upsert({
      sessionId: claims.session_id,
      userId: claims.sub,
      extendedUntil,
    });

    return { ok: true, extendedUntil };
  } catch (error) {
    return failure("Unable to extend the session. Please try again.", error);
  }
}
