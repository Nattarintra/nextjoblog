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
  getSessionLifetimeMs,
} from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { describeAuthError } from "@/lib/auth/error-details";
import { createSessionCycleToken, verifySessionCycleToken } from "@/lib/session/cycle-token";

export type ExtendSessionState =
  | undefined
  | { ok: true; extendedUntil: number; cycleToken: string }
  | { error: "stale" | "unknown"; message: string };

function createFailureState(error: unknown): ExtendSessionState {
  // Keep the browser response deliberately generic, but leave enough safe
  // metadata in the server logs to distinguish an auth, RLS, or schema
  // deployment failure in production. Never log the raw Supabase error: its
  // message can contain request details or provider text.
  console.error(SESSION_EXTENSION_MESSAGES.logLabel, describeAuthError(error));
  return { error: "unknown", message: SESSION_EXTENSION_MESSAGES.failure };
}

export async function extendSession(
  _state: ExtendSessionState,
  formData?: FormData,
): Promise<ExtendSessionState> {
  void _state;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error) {
      throw error;
    }

    const claims = getAuthenticatedClaims(data?.claims);
    const token = verifySessionCycleToken(formData?.get("cycleToken"));
    if (token.sid !== claims.session_id) {
      throw new Error(SESSION_EXTENSION_ERROR_CODES.tokenMismatch);
    }
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

    if (token.exp !== currentEffectiveExpiry) {
      return { error: "stale", message: SESSION_EXTENSION_MESSAGES.stale };
    }

    const extensionResult = await store.compareAndSet({
      sessionId: claims.session_id,
      expectedEffectiveExpiresAt: currentEffectiveExpiry,
      expectedExtendedUntil: extension,
    });

    if (extensionResult.status === "conflict") {
      return { error: "stale", message: SESSION_EXTENSION_MESSAGES.stale };
    }

    return {
      ok: true,
      extendedUntil: extensionResult.extendedUntil,
      cycleToken: createSessionCycleToken({
        sessionId: claims.session_id,
        effectiveExpiresAt: extensionResult.extendedUntil,
      }),
    };
  } catch (error) {
    return createFailureState(error);
  }
}
