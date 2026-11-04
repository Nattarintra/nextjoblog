import { describeAuthError } from "@/lib/auth/error-details";
import {
  completePasswordReset,
  type RecoverySessionTokens,
} from "@/lib/auth/complete-password-reset";
import { logAuthEvent } from "@/lib/auth/log";
import { validateNewPassword } from "@/lib/auth/new-password";
import type { PasswordResetConfirmState } from "@/lib/auth/password-reset-confirm-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createStatelessSupabaseClient } from "@/lib/supabase/stateless";

const CONFIRM_LOG_EVENTS = {
  providerError: "auth.password_reset_confirm.provider_error",
  unexpectedError: "auth.password_reset_confirm.unexpected_error",
} as const;

function readFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function toSessionTokens(session: {
  access_token: string;
  refresh_token: string;
}): RecoverySessionTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
}

export async function executePasswordReset(
  formData: FormData,
): Promise<PasswordResetConfirmState> {
  const accessToken = readFormValue(formData, "access_token");
  const refreshToken = readFormValue(formData, "refresh_token");
  const password = readFormValue(formData, "password");
  const confirmation = readFormValue(formData, "confirmation");
  const validation = validateNewPassword({ password, confirmation });
  if (validation !== "ok") return { status: validation };

  try {
    const statelessClient = createStatelessSupabaseClient();

    return await completePasswordReset(
      {
        auth: {
          async setSession(tokens) {
            const { data, error } = await statelessClient.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
            });

            if (error) {
              logAuthEvent(CONFIRM_LOG_EVENTS.providerError, describeAuthError(error));
            }

            return {
              error,
              session: data.session ? toSessionTokens(data.session) : null,
            };
          },
          async updateUser(input) {
            const { error } = await statelessClient.auth.updateUser(input);

            if (error) {
              logAuthEvent(CONFIRM_LOG_EVENTS.providerError, describeAuthError(error));
            }

            if (error) return { error, session: null };

            const session = await statelessClient.auth.getSession();
            return {
              error: null,
              session: session.data.session ? toSessionTokens(session.data.session) : null,
            };
          },
        },
        session: {
          async start(tokens) {
            const serverClient = await createServerSupabaseClient();
            await serverClient.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
            });
          },
        },
      },
      { accessToken, refreshToken, password, confirmation },
    );
  } catch (error) {
    logAuthEvent(CONFIRM_LOG_EVENTS.unexpectedError, describeAuthError(error));
    return { status: "unknown" };
  }
}
