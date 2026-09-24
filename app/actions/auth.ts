"use server";

import { isAuthApiError } from "@supabase/auth-js";
import { redirect } from "next/navigation";

import { SupabaseConfigError } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const emailShapePattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_LOG_EVENT = {
  signupConfiguration: "auth.signup.configuration_error",
  signupProviderError: "auth.signup.provider_error",
  signupUnexpected: "auth.signup.unexpected_error",
  loginConfiguration: "auth.login.configuration_error",
  loginProviderError: "auth.login.provider_error",
  loginUnexpected: "auth.login.unexpected_error",
} as const;

export type SignupFormState =
  | undefined
  | { error: "duplicate_email" }
  | { error: "weak_password" }
  | { error: "configuration" }
  | { error: "unknown"; message: string }
  | { status: "confirmation_required" };

export type LoginFormState =
  | undefined
  | { error: "invalid_credentials" }
  | { error: "configuration" }
  | { error: "unknown"; message: string }
  | { status: "confirmation_required" };

function isDuplicateEmailError(error: unknown): boolean {
  return (
    isAuthApiError(error) &&
    (error.code === "user_already_exists" ||
      error.message.toLowerCase().includes("already registered"))
  );
}

function isInvalidCredentialsError(error: unknown): boolean {
  return isAuthApiError(error) && error.code === "invalid_credentials";
}

function isEmailNotConfirmedError(error: unknown): boolean {
  return isAuthApiError(error) && error.code === "email_not_confirmed";
}

// Safe diagnostic fields only: event label plus a stable provider code/status.
// Never pass the raw error object, form data, or config error message here.
function logAuthEvent(
  event: string,
  details?: { code?: string; status?: number },
): void {
  console.error(event, details ?? {});
}

export async function signup(
  _state: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (password.length < 6) {
    return { error: "weak_password" };
  }

  if (!emailShapePattern.test(email)) {
    return { error: "unknown", message: "Please enter a valid email address." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (isDuplicateEmailError(error)) {
        return { error: "duplicate_email" };
      }

      logAuthEvent(AUTH_LOG_EVENT.signupProviderError, {
        code: error.code,
        status: error.status,
      });
      return {
        error: "unknown",
        message: "Unable to create account. Please try again.",
      };
    }

    if (!data.user) {
      return {
        error: "unknown",
        message: "Account creation did not return a user.",
      };
    }

    if (!data.session) {
      return { status: "confirmation_required" };
    }
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      logAuthEvent(AUTH_LOG_EVENT.signupConfiguration, { code: error.reason });
      return { error: "configuration" };
    }

    if (isDuplicateEmailError(error)) {
      return { error: "duplicate_email" };
    }

    logAuthEvent(AUTH_LOG_EVENT.signupUnexpected);
    return {
      error: "unknown",
      message: "Unable to create account. Please try again.",
    };
  }

  redirect("/dashboard");
}

export async function login(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!emailShapePattern.test(email)) {
    return { error: "unknown", message: "Please enter a valid email address." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (isInvalidCredentialsError(error)) {
        return { error: "invalid_credentials" };
      }

      if (isEmailNotConfirmedError(error)) {
        return { status: "confirmation_required" };
      }

      logAuthEvent(AUTH_LOG_EVENT.loginProviderError, {
        code: error.code,
        status: error.status,
      });
      return {
        error: "unknown",
        message: "Unable to log in. Please try again.",
      };
    }
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      logAuthEvent(AUTH_LOG_EVENT.loginConfiguration, { code: error.reason });
      return { error: "configuration" };
    }

    if (isInvalidCredentialsError(error)) {
      return { error: "invalid_credentials" };
    }

    if (isEmailNotConfirmedError(error)) {
      return { status: "confirmation_required" };
    }

    logAuthEvent(AUTH_LOG_EVENT.loginUnexpected);
    return {
      error: "unknown",
      message: "Unable to log in. Please try again.",
    };
  }

  redirect("/dashboard");
}
