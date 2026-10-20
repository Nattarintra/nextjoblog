"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import { AuthLogo } from "@/components/auth/AuthLogo";
import {
  authFooterClassName,
  authHeadingClassName,
  authLinkClassName,
  authSubtextClassName,
} from "@/components/auth/styles";

import { LOGOUT_MESSAGES } from "@/lib/auth/messages";
import { LoginConfirmationRequiredAlert, LoginErrorAlert, LoginLoggedOutAlert } from "./LoginAlert";
import { LoginFields } from "./LoginFields";
import { ReturnStrip } from "./ReturnStrip";

export default function LoginForm({
  nextPath = "/dashboard",
  destinationLabel,
  loggedOut = false,
  forgotPasswordEnabled = true,
}: {
  nextPath?: string;
  destinationLabel?: string;
  loggedOut?: boolean;
  forgotPasswordEnabled?: boolean;
}) {
  const returnLabel = loggedOut ? undefined : destinationLabel;
  const [state, formAction, isPending] = useActionState(login, undefined);
  const hasError = Boolean(state && "error" in state);

  return (
    <>
      <AuthLogo />
      <h1 className={authHeadingClassName}>{returnLabel ? "Log In to Continue" : "Log In"}</h1>
      <div className={authSubtextClassName}>
        {returnLabel
          ? "You need to be logged in to open this page."
          : "Log your job applications and track every step in one place."}
      </div>

      {loggedOut && <LoginLoggedOutAlert message={LOGOUT_MESSAGES.loggedOutBanner} />}
      {returnLabel && <ReturnStrip label={returnLabel} />}

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
        forgotPasswordEnabled={forgotPasswordEnabled}
      />

      <div className={authFooterClassName}>
        Don&apos;t have an account? <Link className={authLinkClassName} href="/signup">Sign Up</Link>
      </div>
    </>
  );
}
