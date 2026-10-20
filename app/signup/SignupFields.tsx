import type { ComponentProps } from "react";

import { PasswordField } from "./PasswordField";
import { authFieldLabelClassName, authInputClassName, submitButtonClassName } from "@/components/auth/styles";

export function SignupFields({
  formAction,
  onSubmit,
  passwordMessage,
  isPending,
}: {
  formAction: ComponentProps<"form">["action"];
  onSubmit: ComponentProps<"form">["onSubmit"];
  passwordMessage: string | null;
  isPending: boolean;
}) {
  return (
    <form action={formAction} onSubmit={onSubmit}>
      <div className="mb-3.5">
        <label htmlFor="email" className={authFieldLabelClassName}>
          Email
        </label>
        <input className={authInputClassName} id="email" name="email" type="email" placeholder="you@example.com" required />
      </div>
      <PasswordField message={passwordMessage} />
      <div className="mt-1.5 mb-5" />
      <button className={submitButtonClassName} type="submit" disabled={isPending}>
        {isPending ? "Creating account…" : "Sign Up"}
      </button>
    </form>
  );
}
