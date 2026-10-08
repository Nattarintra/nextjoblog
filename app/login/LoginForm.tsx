"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { authLinkClassName } from "@/components/auth/styles";

import { LoginConfirmationRequiredAlert, LoginErrorAlert } from "./LoginAlert";
import { LoginFields } from "./LoginFields";
import { ReturnStrip } from "./ReturnStrip";

const styles = {
  wrap: "relative box-border flex min-h-[100svh] flex-col overflow-hidden px-6.5 pt-13 pb-7.5 text-white",
  glow: "pointer-events-none absolute -top-22.5 -right-22.5 h-65 w-65 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-azure)_45%,transparent)_0%,transparent_70%)]",
  heading: "mb-1.25 [font-family:var(--font-archivo)] text-[23px] font-bold text-white",
  subheading: "mb-6.5 text-[13px] leading-normal text-sky",
  footer: "mt-auto pt-5.5 text-center text-[12.5px] text-white/55",
};

export default function LoginForm({
  nextPath = "/dashboard",
  destinationLabel,
}: {
  nextPath?: string;
  destinationLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState(login, undefined);
  const hasError = Boolean(state && "error" in state);

  return (
    <div className={styles.wrap}>
      <div className={styles.glow} aria-hidden="true" />
      <AuthLogo />
      <h1 className={styles.heading}>{destinationLabel ? "Log In to Continue" : "Log In"}</h1>
      <div className={styles.subheading}>
        {destinationLabel
          ? "You need to be logged in to open this page."
          : "Log your job applications and track every step in one place."}
      </div>

      {destinationLabel && <ReturnStrip label={destinationLabel} />}

      {state && "error" in state && state.error === "invalid_credentials" && (
        <LoginErrorAlert message="Email or password is incorrect" />
      )}
      {state && "error" in state && state.error === "unknown" && (
        <LoginErrorAlert message={state.message} />
      )}
      {state && "error" in state && state.error === "configuration" && (
        <LoginErrorAlert message="We're unable to log in right now. Please try again shortly." />
      )}
      {state && "status" in state && state.status === "confirmation_required" && (
        <LoginConfirmationRequiredAlert />
      )}

      <LoginFields
        formAction={formAction}
        hasError={hasError}
        isPending={isPending}
        nextPath={nextPath}
      />

      <div className={styles.footer}>
        Don&apos;t have an account? <Link className={authLinkClassName} href="/signup">Sign Up</Link>
      </div>
    </div>
  );
}
