"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  authBlockErrorClassName,
  authHintClassName,
  submitButtonClassName,
} from "@/components/auth/styles";
import { OFFLINE_ERROR_MESSAGE, PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import { validateNewPassword } from "@/lib/auth/new-password";
import type { PasswordResetConfirmState } from "@/lib/auth/password-reset-confirm-state";
import { PASSWORD_RESET_FORM_FIELDS } from "@/lib/auth/password-reset-confirm-config";
import { isPasswordLongEnough } from "@/lib/auth/password-policy";

import { PasswordRequirements } from "./PasswordRequirements";

type NewPasswordFormProps = {
  action: ComponentProps<"form">["action"];
  accessToken: string;
  refreshToken: string;
  email?: string;
  state: PasswordResetConfirmState;
  isPending: boolean;
};

const REQUIREMENTS_ID = "reset-password-requirements";
const PASSWORD_FIELD_IDS = {
  password: "reset-password-new",
  confirmation: "reset-password-confirmation",
} as const;

function getStateError(state: PasswordResetConfirmState): string | null {
  if (!state || state.status === "updated" || state.status === "expired") return null;

  const messages = PASSWORD_RESET_MESSAGES.errors;
  switch (state.status) {
    case "too_short":
      return messages.tooShort;
    case "mismatch":
      return messages.mismatch;
    case "offline":
      return messages.offline;
    case "same_password":
      return messages.samePassword;
    case "network":
      return messages.network;
    case "login_required":
      return messages.loginRequired;
    case "unknown":
      return messages.unknown;
  }
}

function shouldFocusPassword(state: PasswordResetConfirmState): boolean {
  return state?.status === "too_short" || state?.status === "mismatch" || state?.status === "same_password";
}

export default function NewPasswordForm({
  action,
  accessToken,
  refreshToken,
  email,
  state,
  isPending,
}: NewPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const error = localError ?? getStateError(state);

  useEffect(() => {
    if (!state || state.status === "updated" || state.status === "expired") return;
    if (shouldFocusPassword(state)) passwordRef.current?.focus();
    else errorRef.current?.focus();
  }, [state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const validation = validateNewPassword({ password, confirmation });
    if (!navigator.onLine) {
      event.preventDefault();
      setLocalError(OFFLINE_ERROR_MESSAGE);
      return;
    }
    if (validation !== "ok") {
      event.preventDefault();
      setLocalError(getStateError({ status: validation }));
      if (validation === "too_short" || validation === "mismatch") {
        window.requestAnimationFrame(() => passwordRef.current?.focus());
      }
      return;
    }
    setLocalError(null);
  }

  return (
    <form action={action} noValidate onSubmit={handleSubmit}>
      <input type="hidden" name={PASSWORD_RESET_FORM_FIELDS.accessToken} value={accessToken} readOnly />
      <input type="hidden" name={PASSWORD_RESET_FORM_FIELDS.refreshToken} value={refreshToken} readOnly />
      <div className="mb-3.5">
        <PasswordInput
          id={PASSWORD_FIELD_IDS.password}
          name={PASSWORD_RESET_FORM_FIELDS.password}
          label={PASSWORD_RESET_MESSAGES.newPasswordLabel}
          autoComplete="new-password"
          autoFocus
          describedBy={REQUIREMENTS_ID}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          warning={password.length > 0 && !isPasswordLongEnough(password)}
          ref={passwordRef}
        />
      </div>
      <div className="mb-3.5">
        <PasswordInput
          id={PASSWORD_FIELD_IDS.confirmation}
          name={PASSWORD_RESET_FORM_FIELDS.confirmation}
          label={PASSWORD_RESET_MESSAGES.confirmPasswordLabel}
          autoComplete="new-password"
          describedBy={REQUIREMENTS_ID}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          warning={
            confirmation.length > 0 &&
            (!isPasswordLongEnough(confirmation) || password !== confirmation)
          }
        />
      </div>
      <PasswordRequirements password={password} confirmation={confirmation} id={REQUIREMENTS_ID} />
      {email && <p className={authHintClassName}>{PASSWORD_RESET_MESSAGES.resettingFor(email)}</p>}
      {error && (
        <div ref={errorRef} className={authBlockErrorClassName} role="alert" tabIndex={-1}>
          {error}
        </div>
      )}
      <button
        className={`${submitButtonClassName} mt-5`}
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? PASSWORD_RESET_MESSAGES.savingButton : PASSWORD_RESET_MESSAGES.saveButton}
      </button>
    </form>
  );
}
