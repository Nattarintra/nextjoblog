"use client";

import { useActionState, useState } from "react";

import { signup } from "@/app/actions/auth";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFooter, AuthLink } from "@/components/auth/AuthFooter";
import { SIGNUP_MESSAGES } from "@/lib/auth/messages";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getPasswordValidationError, PASSWORD_HELPER_TEXT } from "./password-validation";
import {
  ConfigurationErrorAlert,
  ConfirmationRequiredAlert,
  DuplicateEmailAlert,
  UnknownErrorAlert,
} from "./SignupAlerts";
import { SignupFields } from "./SignupFields";

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, undefined);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordMessage =
    passwordError ??
    (state && "error" in state && state.error === "weak_password" ? PASSWORD_HELPER_TEXT : null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const passwordValue = formData.get("password");
    const password = typeof passwordValue === "string" ? passwordValue : "";
    const validationError = getPasswordValidationError(password);

    if (validationError) {
      event.preventDefault();
      setPasswordError(validationError);
      return;
    }

    setPasswordError(null);
  }

  return (
    <>
      <AuthHeader title={SIGNUP_MESSAGES.heading} subtitle={SIGNUP_MESSAGES.subtitle} />

      {state && "error" in state && state.error === "duplicate_email" && <DuplicateEmailAlert />}
      {state && "error" in state && state.error === "unknown" && (
        <UnknownErrorAlert message={state.message} />
      )}
      {state && "error" in state && state.error === "configuration" && <ConfigurationErrorAlert />}
      {state && "status" in state && state.status === "confirmation_required" && (
        <ConfirmationRequiredAlert />
      )}

      <SignupFields
        formAction={formAction}
        onSubmit={handleSubmit}
        passwordMessage={passwordMessage}
        isPending={isPending}
      />

      <AuthFooter>{SIGNUP_MESSAGES.haveAccount} <AuthLink href={LOGIN_PATH}>{SIGNUP_MESSAGES.logIn}</AuthLink></AuthFooter>
    </>
  );
}
