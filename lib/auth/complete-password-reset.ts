import {
  AuthError,
  AuthRetryableFetchError,
  isAuthApiError,
  isAuthSessionMissingError,
} from "@supabase/auth-js";

import { validateNewPassword } from "@/lib/auth/new-password";
import type { PasswordResetConfirmState } from "@/lib/auth/password-reset-confirm-state";

const PASSWORD_TOO_WEAK_CODE = "weak_password";
const SAME_PASSWORD_CODE = "same_password";
const EXPIRED_ERROR_CODES = new Set([
  "otp_expired",
  "session_expired",
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
  "invalid_jwt",
]);
const SERVER_FAILURE_MIN_STATUS = 500;
const NETWORK_FAILURE_STATUS = 0;

export type RecoverySessionTokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthOperationResult = {
  error: unknown | null;
  session?: RecoverySessionTokens | null;
};

export type RecoveryAuthClient = {
  setSession: (tokens: RecoverySessionTokens) => Promise<AuthOperationResult>;
  updateUser: (input: {
    password: string;
  }) => Promise<AuthOperationResult>;
};

export type SessionStarter = {
  start: (tokens: RecoverySessionTokens) => Promise<void> | void;
};

export type CompletePasswordResetDependencies = {
  auth: RecoveryAuthClient;
  session: SessionStarter;
};

function readErrorDetails(error: unknown): {
  code?: string;
  status?: number;
} {
  if (typeof error !== "object" || error === null) return {};
  const details = error as { code?: unknown; status?: unknown };
  return {
    ...(typeof details.code === "string" ? { code: details.code } : {}),
    ...(typeof details.status === "number" ? { status: details.status } : {}),
  };
}

function isNetworkError(error: unknown): boolean {
  const { status } = readErrorDetails(error);
  return (
    error instanceof AuthRetryableFetchError ||
    error instanceof TypeError ||
    status === NETWORK_FAILURE_STATUS ||
    (status !== undefined && status >= SERVER_FAILURE_MIN_STATUS)
  );
}

export function classifyRecoveryError(error: unknown): Exclude<
  PasswordResetConfirmState,
  undefined | { status: "updated" }
> extends infer State
  ? State extends { status: infer Status }
    ? Status
    : never
  : never {
  if (isAuthSessionMissingError(error)) return "expired";

  const { code } = readErrorDetails(error);
  if (code === PASSWORD_TOO_WEAK_CODE) return "too_short";
  if (code === SAME_PASSWORD_CODE) return "same_password";
  if (code && EXPIRED_ERROR_CODES.has(code)) return "expired";
  if (isNetworkError(error)) return "network";

  return "unknown";
}

function isMissingSessionError(error: unknown): boolean {
  return isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && error.code === "session_not_found");
}

function stateFromError(error: unknown): Exclude<
  PasswordResetConfirmState,
  undefined | { status: "updated" }
> {
  return { status: classifyRecoveryError(error) } as Exclude<
    PasswordResetConfirmState,
    undefined | { status: "updated" }
  >;
}

export async function completePasswordReset(
  dependencies: CompletePasswordResetDependencies,
  input: RecoverySessionTokens & {
    password: string;
    confirmation: string;
  },
): Promise<PasswordResetConfirmState> {
  const validation = validateNewPassword(input);
  if (validation !== "ok") return { status: validation };

  let sessionTokens: RecoverySessionTokens | undefined;

  try {
    const sessionResult = await dependencies.auth.setSession(input);
    if (sessionResult.error) return stateFromError(sessionResult.error);
    if (!sessionResult.session) return { status: "expired" };
    sessionTokens = sessionResult.session;

    const updateResult = await dependencies.auth.updateUser({
      password: input.password,
    });
    if (updateResult.error) {
      return stateFromError(updateResult.error);
    }

    sessionTokens = updateResult.session ?? sessionTokens;
    await dependencies.session.start(sessionTokens);
    return { status: "updated" };
  } catch (error) {
    if (error instanceof AuthError && isMissingSessionError(error)) {
      return { status: "expired" };
    }
    return stateFromError(error);
  }
}
