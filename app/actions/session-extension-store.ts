import type { SupabaseClient } from "@supabase/supabase-js";

import { SESSION_EXTENSION_ERROR_CODES } from "@/app/actions/session-errors";

type SessionExtensionRecord = {
  extended_until: string;
};

export interface SessionExtensionStore {
  findBySessionId(sessionId: string): Promise<number | undefined>;
  upsert(extension: {
    sessionId: string;
    userId: string;
    extendedUntil: number;
  }): Promise<void>;
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
