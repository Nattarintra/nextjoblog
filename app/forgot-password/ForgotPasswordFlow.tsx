"use client";

import { useActionState, useState } from "react";

import { requestPasswordResetAction } from "@/app/actions/password-reset";
import type { ForgotPasswordFormState } from "@/lib/auth/password-reset-state";

import CheckYourEmailScreen from "./CheckYourEmailScreen";
import ForgotPasswordForm from "./ForgotPasswordForm";
import TooManyRequestsScreen from "./TooManyRequestsScreen";

export default function ForgotPasswordFlow() {
  const [showFormOverride, setShowFormOverride] = useState(false);
  const [email, setEmail] = useState("");
  const [resendGeneration, setResendGeneration] = useState(0);
  const flowAction = async (previous: ForgotPasswordFormState, formData: FormData) => {
    const nextState = await requestPasswordResetAction(previous, formData);
    if (nextState && "status" in nextState) {
      setShowFormOverride(false);
      if (nextState.status === "sent") {
        setResendGeneration((generation) => generation + 1);
      }
    }
    return nextState;
  };
  const [state, formAction, isPending] = useActionState<ForgotPasswordFormState, FormData>(
    flowAction,
    undefined,
  );

  if (showFormOverride || !state) {
    return (
      <ForgotPasswordForm
        action={formAction}
        isPending={isPending}
        hasError={state ? "error" in state && state.error === "invalid_email" : false}
        onSubmit={(submittedEmail) => setEmail(submittedEmail)}
      />
    );
  }

  if ("error" in state) {
    return (
      <ForgotPasswordForm
        action={formAction}
        isPending={isPending}
        hasError={state.error === "invalid_email"}
        onSubmit={(submittedEmail) => setEmail(submittedEmail)}
      />
    );
  }

  if (state.status === "rate_limited") {
    return (
      <TooManyRequestsScreen
        key={state.retryAfterSeconds}
        email={email}
        retryAfterSeconds={state.retryAfterSeconds}
        action={formAction}
        isPending={isPending}
      />
    );
  }

  return (
    <CheckYourEmailScreen
      email={state.email}
      action={formAction}
      isPending={isPending}
      resendGeneration={resendGeneration}
      onUseDifferentEmail={() => setShowFormOverride(true)}
    />
  );
}
