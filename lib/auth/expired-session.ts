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
const CLEANUP_TIMEOUT_MS = 5_000;

export function createExpiredSessionCleanup(
  deps: ExpiredSessionDependencies,
): () => Promise<void> {
  return async () => {
    let rejectTimeout!: (reason?: unknown) => void;
    const timeout = new Promise<never>((_, reject) => {
      rejectTimeout = reject;
    });
    const timeoutId = setTimeout(
      () => rejectTimeout(new Error("Expired-session cleanup timed out")),
      CLEANUP_TIMEOUT_MS,
    );

    try {
      const cleanup = (async () => {
        const { auth } = await deps.createClient();
        const { error } = await auth.signOut(LOCAL_SCOPE);

        if (error) {
          deps.log(
            EXPIRED_SESSION_LOG_EVENT.providerError,
            describeAuthError(error),
          );
        }
      })();

      await Promise.race([
        cleanup,
        timeout,
      ]);
    } catch (error) {
      if (error instanceof SupabaseConfigError) {
        deps.log(EXPIRED_SESSION_LOG_EVENT.configuration, {
          code: error.reason,
        });
        return;
      }

      deps.log(EXPIRED_SESSION_LOG_EVENT.unexpected);
    } finally {
      clearTimeout(timeoutId);
    }
  };
}
