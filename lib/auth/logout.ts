import { LOGOUT_FAILURES, LOGOUT_SUCCESS } from "@/lib/auth/logout-state";
import type { LogoutState } from "@/lib/auth/logout-state";
import { LOGOUT_LOG_EVENT } from "@/lib/auth/messages";
import { signOutCurrentSession } from "@/lib/auth/sign-out";
import type { SignOutResult } from "@/lib/auth/sign-out";
import { SupabaseConfigError } from "@/lib/supabase/config";

type LogoutAuth = Parameters<typeof signOutCurrentSession>[0];

type LogoutDependencies = {
  createClient: () => Promise<{ auth: LogoutAuth }>;
  log: (event: string, details?: { code?: string; status?: number }) => void;
  // Test-only seam: lets E2E force failure branches without a network fault.
  forcedOutcome?: () => Promise<"fail" | "unconfirmed" | undefined>;
};

const FORCED_RESULTS: Record<"fail" | "unconfirmed", SignOutResult> = {
  fail: { kind: "still_signed_in" },
  unconfirmed: { kind: "unconfirmed" },
};

function mapResult(result: SignOutResult, log: LogoutDependencies["log"]): LogoutState {
  if (result.kind === "signed_out") return LOGOUT_SUCCESS;

  const event =
    result.kind === "still_signed_in"
      ? LOGOUT_LOG_EVENT.providerError
      : LOGOUT_LOG_EVENT.unconfirmed;
  log(event, { code: result.code, status: result.status });
  return LOGOUT_FAILURES[result.kind];
}

export function createLogout(
  deps: LogoutDependencies,
): () => Promise<LogoutState> {
  return async () => {
    try {
      const forced = await deps.forcedOutcome?.();
      if (forced) return mapResult(FORCED_RESULTS[forced], deps.log);

      const { auth } = await deps.createClient();
      return mapResult(await signOutCurrentSession(auth), deps.log);
    } catch (error) {
      if (error instanceof SupabaseConfigError) {
        deps.log(LOGOUT_LOG_EVENT.configuration, { code: error.reason });
        return LOGOUT_FAILURES.configuration;
      }

      deps.log(LOGOUT_LOG_EVENT.unexpected);
      return LOGOUT_FAILURES.unknown;
    }
  };
}
