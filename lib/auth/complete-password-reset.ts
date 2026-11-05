import {
  AuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/auth-js";

import { describeAuthError } from "@/lib/auth/error-details";
import { validateNewPassword } from "@/lib/auth/new-password";
import type {
  PasswordResetConfirmState,
  PasswordResetErrorStatus,
} from "@/lib/auth/password-reset-confirm-state";

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

function isNetworkError(error: unknown): boolean {
  const { status } = describeAuthError(error);
  return (
    error instanceof AuthRetryableFetchError ||
    error instanceof TypeError ||
    status === NETWORK_FAILURE_STATUS ||
    (status !== undefined && status >= SERVER_FAILURE_MIN_STATUS)
  );
}

export type RecoveryErrorStatus = Extract<
  PasswordResetErrorStatus,
  "too_short" | "same_password" | "expired" | "network" | "unknown"
>;

export function classifyRecoveryError(error: unknown): RecoveryErrorStatus {
  if (isAuthSessionMissingError(error)) return "expired";

  const { code } = describeAuthError(error);
  if (code === PASSWORD_TOO_WEAK_CODE) return "too_short";
  if (code === SAME_PASSWORD_CODE) return "same_password";
  if (code && EXPIRED_ERROR_CODES.has(code)) return "expired";
  if (isNetworkError(error)) return "network";

  return "unknown";
}

function stateFromError(error: unknown): PasswordResetConfirmState {
  return { status: classifyRecoveryError(error) };
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
  } catch (error) {
    return stateFromError(error);
  }

  // The password is already changed here, so a failure to start the cookie
  // session must not be reported as an ordinary save failure or as success.
  try {
    await dependencies.session.start(sessionTokens);
  } catch {
    return { status: "login_required" };
  }
  return { status: "updated" };
}
