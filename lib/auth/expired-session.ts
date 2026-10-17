import type { SupabaseClient } from "@supabase/supabase-js";

import { describeAuthError } from "@/lib/auth/error-details";
import type { AuthLogDetails } from "@/lib/auth/error-details";
import { EXPIRED_SESSION_LOG_EVENT } from "@/lib/auth/messages";
import { SupabaseConfigError } from "@/lib/supabase/config";

type ExpiredSessionAuth = Pick<SupabaseClient["auth"], "signOut">;

export type ExpiredSessionDependencies = {
  createClient: () => Promise<{ auth: ExpiredSessionAuth }>;
  log: (event: string, details?: AuthLogDetails) => void;
};

const LOCAL_SCOPE = { scope: "local" } as const;

export function createExpiredSessionCleanup(
  deps: ExpiredSessionDependencies,
): () => Promise<void> {
  return async () => {
    try {
      const { auth } = await deps.createClient();
      const { error } = await auth.signOut(LOCAL_SCOPE);

      if (error) {
        deps.log(
          EXPIRED_SESSION_LOG_EVENT.providerError,
          describeAuthError(error),
        );
      }
    } catch (error) {
      if (error instanceof SupabaseConfigError) {
        deps.log(EXPIRED_SESSION_LOG_EVENT.configuration, {
          code: error.reason,
        });
        return;
      }

      deps.log(EXPIRED_SESSION_LOG_EVENT.unexpected);
    }
  };
}
