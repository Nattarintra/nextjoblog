"use client";

import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFooter, AuthLink } from "@/components/auth/AuthFooter";

import { LOGIN_MESSAGES, LOGOUT_MESSAGES } from "@/lib/auth/messages";
import { DEFAULT_POST_LOGIN_PATH, SIGNUP_PATH } from "@/lib/auth/paths";
import { LoginConfirmationRequiredAlert, LoginErrorAlert, LoginLoggedOutAlert, LoginSessionExpiredAlert } from "./LoginAlert";
import { LoginFields } from "./LoginFields";
import { ReturnStrip } from "./ReturnStrip";

export default function LoginForm({
  nextPath = DEFAULT_POST_LOGIN_PATH,
  destinationLabel,
  loggedOut = false,
  sessionExpired = false,
  forgotPasswordEnabled = true,
}: {
  nextPath?: string;
  destinationLabel?: string;
  loggedOut?: boolean;
  sessionExpired?: boolean;
  forgotPasswordEnabled?: boolean;
}) {
  const returnLabel = loggedOut || sessionExpired ? undefined : destinationLabel;
  const [state, formAction, isPending] = useActionState(login, undefined);
  const hasError = Boolean(state && "error" in state);

  return (
    <>
      <AuthHeader title={sessionExpired ? LOGIN_MESSAGES.sessionExpired.heading : returnLabel ? LOGIN_MESSAGES.redirectHeading : LOGIN_MESSAGES.heading} subtitle={returnLabel ? LOGIN_MESSAGES.redirectSubtitle : LOGIN_MESSAGES.subtitle} />

      {loggedOut && <LoginLoggedOutAlert message={LOGOUT_MESSAGES.loggedOutBanner} />}
      {sessionExpired && <LoginSessionExpiredAlert />}
      {returnLabel && <ReturnStrip label={returnLabel} />}

      {state && "error" in state && state.error === "invalid_credentials" && <LoginErrorAlert message={LOGIN_MESSAGES.invalidCredentials} />}
      {state && "error" in state && state.error === "unknown" && (
        <LoginErrorAlert message={state.message} />
      )}
      {state && "error" in state && state.error === "configuration" && (
        <LoginErrorAlert message={LOGIN_MESSAGES.configuration} />
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

      <AuthFooter>{LOGIN_MESSAGES.noAccount} <AuthLink href={SIGNUP_PATH}>{LOGIN_MESSAGES.signUp}</AuthLink></AuthFooter>
    </>
  );
}
