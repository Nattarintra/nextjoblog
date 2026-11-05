import { describeAuthError } from "@/lib/auth/error-details";
import {
  completePasswordReset,
  type RecoverySessionTokens,
} from "@/lib/auth/complete-password-reset";
import { logAuthEvent } from "@/lib/auth/log";
import { PASSWORD_RESET_CONFIRM_LOG_EVENT } from "@/lib/auth/messages";
import { validateNewPassword } from "@/lib/auth/new-password";
import {
  PASSWORD_RESET_FORM_FIELDS,
  PASSWORD_RESET_MAX_FIELD_LENGTH,
} from "@/lib/auth/password-reset-confirm-config";
import type { PasswordResetConfirmState } from "@/lib/auth/password-reset-confirm-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createStatelessSupabaseClient } from "@/lib/supabase/stateless";

function readFormValue(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (value === null) return "";
  if (typeof value !== "string" || value.length > PASSWORD_RESET_MAX_FIELD_LENGTH) {
    return null;
  }
  return value;
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
  const accessToken = readFormValue(formData, PASSWORD_RESET_FORM_FIELDS.accessToken);
  const refreshToken = readFormValue(formData, PASSWORD_RESET_FORM_FIELDS.refreshToken);
  const password = readFormValue(formData, PASSWORD_RESET_FORM_FIELDS.password);
  const confirmation = readFormValue(formData, PASSWORD_RESET_FORM_FIELDS.confirmation);
  if (
    accessToken === null ||
    refreshToken === null ||
    password === null ||
    confirmation === null
  ) {
    return { status: "unknown" };
  }
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
              logAuthEvent(PASSWORD_RESET_CONFIRM_LOG_EVENT.providerError, describeAuthError(error));
            }

            return {
              error,
              session: data.session ? toSessionTokens(data.session) : null,
            };
          },
          async updateUser(input) {
            const { error } = await statelessClient.auth.updateUser(input);

            if (error) {
              logAuthEvent(PASSWORD_RESET_CONFIRM_LOG_EVENT.providerError, describeAuthError(error));
              return { error, session: null };
            }

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
            const { error } = await serverClient.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
            });

            if (error) {
              logAuthEvent(
                PASSWORD_RESET_CONFIRM_LOG_EVENT.sessionStartError,
                describeAuthError(error),
              );
              throw error;
            }
          },
        },
      },
      { accessToken, refreshToken, password, confirmation },
    );
  } catch (error) {
    logAuthEvent(PASSWORD_RESET_CONFIRM_LOG_EVENT.unexpectedError, describeAuthError(error));
    return { status: "unknown" };
  }
}
