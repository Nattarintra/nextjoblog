"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signup } from "@/app/actions/auth";

import { AuthLogo } from "./AuthLogo";
import { getPasswordValidationError, PASSWORD_HELPER_TEXT } from "./password-validation";
import { DuplicateEmailAlert, UnknownErrorAlert } from "./SignupAlerts";
import { SignupFields } from "./SignupFields";
import { authLinkClassName } from "./styles";

const styles = {
  wrap: "relative box-border flex min-h-[100svh] flex-col overflow-hidden px-6.5 pt-13 pb-7.5 text-white",
  glow: "pointer-events-none absolute -top-22.5 -right-22.5 h-65 w-65 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-azure)_45%,transparent)_0%,transparent_70%)]",
  heading: "mb-1.25 [font-family:var(--font-archivo)] text-[23px] font-bold text-white",
  subheading: "mb-6.5 text-[13px] leading-normal text-sky",
  footer: "mt-auto pt-5.5 text-center text-[12.5px] text-white/55",
};

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, undefined);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordMessage =
    passwordError ?? (state?.error === "weak_password" ? PASSWORD_HELPER_TEXT : null);

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
    <div className={styles.wrap}>
      <div className={styles.glow} aria-hidden="true" />
      <AuthLogo />
      <div className={styles.heading}>Create Your NextJobLog Account</div>
      <div className={styles.subheading}>
        Your application data is encrypted and visible only to you.
      </div>

      {state?.error === "duplicate_email" && <DuplicateEmailAlert />}
      {state?.error === "unknown" && <UnknownErrorAlert message={state.message} />}

      <SignupFields
        formAction={formAction}
        onSubmit={handleSubmit}
        passwordMessage={passwordMessage}
        isPending={isPending}
      />

      <div className={styles.footer}>
        Already have an account? <Link className={authLinkClassName} href="/login">Log In</Link>
      </div>
    </div>
  );
}
