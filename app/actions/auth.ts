"use server";

import { isAuthApiError } from "@supabase/auth-js";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SignupFormState =
  | undefined
  | { error: "duplicate_email" }
  | { error: "weak_password" }
  | { error: "unknown"; message: string };

function isDuplicateEmailError(error: unknown): boolean {
  return (
    isAuthApiError(error) &&
    (error.code === "user_already_exists" ||
      error.message.toLowerCase().includes("already registered"))
  );
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

  if (!email || !email.includes("@")) {
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

      console.error("Signup failed", error);
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

  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { error: "duplicate_email" };
    }

    console.error("Signup failed", error);
    return {
      error: "unknown",
      message: "Unable to create account. Please try again.",
    };
  }

  redirect("/dashboard");
}
