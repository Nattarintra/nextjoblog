import { LOGOUT_LOG_EVENT, LOGOUT_MESSAGES } from "@/app/actions/logout-messages";
import { signOutCurrentSession } from "@/lib/auth/sign-out";
import type { SignOutResult } from "@/lib/auth/sign-out";
import { SupabaseConfigError } from "@/lib/supabase/config";

type LogoutErrorKind = "still_signed_in" | "unconfirmed" | "configuration" | "unknown";

export type LogoutState =
  | undefined
  | { ok: true }
  | { error: LogoutErrorKind; message: string };

type LogoutAuth = Parameters<typeof signOutCurrentSession>[0];

type LogoutDependencies = {
  createClient: () => Promise<{ auth: LogoutAuth }>;
  log: (event: string, details?: { code?: string; status?: number }) => void;
  // Test-only seam: lets E2E force failure branches without a network fault.
  forcedOutcome?: () => Promise<"fail" | "unconfirmed" | undefined>;
};

const ERROR_STATES: Record<LogoutErrorKind, { error: LogoutErrorKind; message: string }> = {
  still_signed_in: { error: "still_signed_in", message: LOGOUT_MESSAGES.stillSignedIn },
  unconfirmed: { error: "unconfirmed", message: LOGOUT_MESSAGES.unconfirmed },
  configuration: { error: "configuration", message: LOGOUT_MESSAGES.configuration },
  unknown: { error: "unknown", message: LOGOUT_MESSAGES.unknown },
};

const FORCED_RESULTS: Record<"fail" | "unconfirmed", SignOutResult> = {
  fail: { kind: "still_signed_in" },
  unconfirmed: { kind: "unconfirmed" },
};

function mapResult(result: SignOutResult, log: LogoutDependencies["log"]): LogoutState {
  if (result.kind === "signed_out") return { ok: true };

  const event =
    result.kind === "still_signed_in"
      ? LOGOUT_LOG_EVENT.providerError
      : LOGOUT_LOG_EVENT.unconfirmed;
  log(event, { code: result.code, status: result.status });
  return ERROR_STATES[result.kind];
}

export function createLogout(
  deps: LogoutDependencies,
): (state: LogoutState) => Promise<LogoutState> {
  return async () => {
    try {
      const forced = await deps.forcedOutcome?.();
      if (forced) return mapResult(FORCED_RESULTS[forced], deps.log);

      const { auth } = await deps.createClient();
      return mapResult(await signOutCurrentSession(auth), deps.log);
    } catch (error) {
      if (error instanceof SupabaseConfigError) {
        deps.log(LOGOUT_LOG_EVENT.configuration, { code: error.reason });
        return ERROR_STATES.configuration;
      }

      deps.log(LOGOUT_LOG_EVENT.unexpected);
      return ERROR_STATES.unknown;
    }
  };
}
