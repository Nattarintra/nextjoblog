"use server";

import { SESSION_EXTENSION_MESSAGES } from "@/app/actions/session-messages";
import {
  computeBaseSessionExpiry,
  getAuthenticatedClaims,
} from "@/lib/session/claims";
import { SESSION_EXTENSION_ERROR_CODES } from "@/lib/session/errors";
import { createSupabaseSessionExtensionStore } from "@/lib/session/extension-store";
import {
  computeEffectiveSessionExpiresAt,
  computeNextSessionExpiry,
  getSessionLifetimeMs,
} from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ExtendSessionState =
  | undefined
  | { ok: true; extendedUntil: number }
  | { error: "unknown"; message: string };

function createFailureState(error: unknown): ExtendSessionState {
  console.error(SESSION_EXTENSION_MESSAGES.logLabel, error);
  return { error: "unknown", message: SESSION_EXTENSION_MESSAGES.failure };
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
    const currentEffectiveExpiry = computeEffectiveSessionExpiresAt(
      baseExpiry,
      extension,
    );

    if (Date.now() >= currentEffectiveExpiry) {
      throw new Error(SESSION_EXTENSION_ERROR_CODES.expired);
    }

    const extendedUntil = computeNextSessionExpiry(currentEffectiveExpiry);

    await store.upsert({
      sessionId: claims.session_id,
      userId: claims.sub,
      extendedUntil,
    });

    return { ok: true, extendedUntil };
  } catch (error) {
    return createFailureState(error);
  }
}
