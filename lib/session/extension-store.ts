import type { SupabaseClient } from "@supabase/supabase-js";

import { SESSION_EXTENSION_ERROR_CODES } from "./errors";

type SessionExtensionRecord = {
  extended_until: string;
};

type SessionExtensionRpcRecord = {
  result: "success" | "conflict";
  extended_until: string | null;
};

export type SessionExtensionCompareAndSetResult =
  | { status: "success"; extendedUntil: number }
  | { status: "conflict" };

export interface SessionExtensionStore {
  findBySessionId(sessionId: string): Promise<number | undefined>;
  compareAndSet(extension: {
    sessionId: string;
    expectedEffectiveExpiresAt: number;
    expectedExtendedUntil?: number;
  }): Promise<SessionExtensionCompareAndSetResult>;
}

export function createSupabaseSessionExtensionStore(
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

      if (!data) {
        return undefined;
      }

      const extendedUntil = Date.parse(
        (data as SessionExtensionRecord).extended_until,
      );

      if (!Number.isFinite(extendedUntil)) {
        throw new Error(SESSION_EXTENSION_ERROR_CODES.extensionMalformed);
      }

      return extendedUntil;
    },

    async compareAndSet({
      sessionId,
      expectedEffectiveExpiresAt,
      expectedExtendedUntil,
    }) {
      const { data, error } = await supabase.rpc("extend_session_if_current", {
        p_session_id: sessionId,
        p_expected_extended_until:
          expectedExtendedUntil === undefined
            ? null
            : new Date(expectedExtendedUntil).toISOString(),
        p_expected_effective_expires_at: new Date(
          expectedEffectiveExpiresAt,
        ).toISOString(),
      });

      if (error) {
        throw new Error(SESSION_EXTENSION_ERROR_CODES.extensionRpcFailed);
      }

      if (!Array.isArray(data) || data.length !== 1) {
        throw new Error(SESSION_EXTENSION_ERROR_CODES.extensionRpcMalformed);
      }

      const result = data[0] as Partial<SessionExtensionRpcRecord>;
      if (result.result === "conflict" && result.extended_until === null) {
        return { status: "conflict" };
      }

      if (result.result !== "success" || typeof result.extended_until !== "string") {
        throw new Error(SESSION_EXTENSION_ERROR_CODES.extensionRpcMalformed);
      }

      const extendedUntil = Date.parse(result.extended_until);
      if (!Number.isFinite(extendedUntil)) {
        throw new Error(SESSION_EXTENSION_ERROR_CODES.extensionRpcMalformed);
      }

      return { status: "success", extendedUntil };
    },
  };
}
