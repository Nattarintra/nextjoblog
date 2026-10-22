"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signup } from "@/app/actions/auth";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { getPasswordValidationError, PASSWORD_HELPER_TEXT } from "./password-validation";
import {
  ConfigurationErrorAlert,
  ConfirmationRequiredAlert,
  DuplicateEmailAlert,
  UnknownErrorAlert,
} from "./SignupAlerts";
import { SignupFields } from "./SignupFields";
import {
  authFooterClassName,
  authHeadingClassName,
  authLinkClassName,
  authSubtextClassName,
} from "@/components/auth/styles";

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
      <AuthLogo />
      <h1 className={authHeadingClassName}>Create Your NextJobLog Account</h1>
      <div className={authSubtextClassName}>
        Your application data is encrypted and visible only to you.
      </div>

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

      <div className={authFooterClassName}>
        Already have an account? <Link className={authLinkClassName} href="/login">Log In</Link>
      </div>
    </>
  );
}
