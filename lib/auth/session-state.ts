import {
  AuthError,
  AuthInvalidJwtError,
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/auth-js";

export type Claims = Record<string, unknown>;

export type ClaimsState =
  | { kind: "authenticated"; claims: Claims }
  | {
      kind: "unauthenticated";
      reason: "missing" | "invalid" | "expired";
    }
  | { kind: "verification_failed" };

type ClaimsResult = { data: { claims: Claims } | null; error: unknown };

function unauthenticated(
  reason: "missing" | "invalid" | "expired",
): ClaimsState {
  return { kind: "unauthenticated", reason };
}

function isExpiredError(error: unknown): boolean {
  return isAuthApiError(error) && error.code === "session_expired";
}

function isInvalidJwt(error: unknown): boolean {
  return error instanceof AuthInvalidJwtError;
}

function isServerAuthError(error: unknown): boolean {
  return (
    error instanceof AuthError &&
    (error.status === 0 || (error.status !== undefined && error.status >= 500))
  );
}

export function classifyClaimsResult(result: ClaimsResult): ClaimsState {
  const { data, error } = result;

  if (error == null && data == null) {
    return unauthenticated("missing");
  }

  if (error != null) {
    if (isAuthSessionMissingError(error)) return unauthenticated("missing");
    if (isExpiredError(error)) return unauthenticated("expired");
    if (isInvalidJwt(error)) return unauthenticated("invalid");
    if (isAuthRetryableFetchError(error) || isServerAuthError(error)) {
      return { kind: "verification_failed" };
    }
    return { kind: "verification_failed" };
  }

  return data?.claims
    ? { kind: "authenticated", claims: data.claims }
    : unauthenticated("missing");
}

export function classifyThrown(error: unknown): ClaimsState {
  void error;
  return { kind: "verification_failed" };
}
