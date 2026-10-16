import { LOGOUT_MESSAGES, OFFLINE_ERROR_MESSAGE } from "@/lib/auth/messages";

// Pure and client-safe: no server imports, so the browser hook and the server
// core share one definition of every logout outcome.
export type LogoutErrorKind =
  | "still_signed_in"
  | "unconfirmed"
  | "configuration"
  | "unknown"
  | "offline";

export type LogoutSuccess = { ok: true };
export type LogoutFailure = { error: LogoutErrorKind; message: string };
export type LogoutState = undefined | LogoutSuccess | LogoutFailure;

export const LOGOUT_SUCCESS: LogoutSuccess = { ok: true };

export const LOGOUT_FAILURES: Record<LogoutErrorKind, LogoutFailure> = {
  still_signed_in: { error: "still_signed_in", message: LOGOUT_MESSAGES.stillSignedIn },
  unconfirmed: { error: "unconfirmed", message: LOGOUT_MESSAGES.unconfirmed },
  configuration: { error: "configuration", message: LOGOUT_MESSAGES.configuration },
  unknown: { error: "unknown", message: LOGOUT_MESSAGES.unknown },
  offline: { error: "offline", message: OFFLINE_ERROR_MESSAGE },
};

export function isLogoutSuccess(state: LogoutState): state is LogoutSuccess {
  return state !== undefined && "ok" in state;
}

export function getLogoutFailure(state: LogoutState): LogoutFailure | undefined {
  return state !== undefined && "error" in state ? state : undefined;
}
