"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";

import type { PasswordResetConfirmState } from "@/lib/auth/password-reset-confirm-state";
import {
  PASSWORD_UPDATED_TOAST_COOKIE_MAX_AGE_SECONDS,
  PASSWORD_UPDATED_TOAST_FLAG,
} from "@/lib/auth/password-reset-confirm-config";
import { DEFAULT_POST_LOGIN_PATH } from "@/lib/auth/paths";
import { executePasswordReset } from "@/lib/auth/reset-password-service";

export type { PasswordResetConfirmState } from "@/lib/auth/password-reset-confirm-state";

export async function resetPasswordAction(
  _previousState: PasswordResetConfirmState,
  formData: FormData,
): Promise<PasswordResetConfirmState> {
  const state = await executePasswordReset(formData);
  if (state?.status === "updated") {
    const cookieStore = await cookies();
    cookieStore.set(PASSWORD_UPDATED_TOAST_FLAG, "1", {
      httpOnly: false,
      maxAge: PASSWORD_UPDATED_TOAST_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    redirect(DEFAULT_POST_LOGIN_PATH, RedirectType.replace);
  }
  return state;
}
