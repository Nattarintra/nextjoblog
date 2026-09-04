import type { ComponentProps } from "react";

import { PasswordField } from "./PasswordField";
import { authFieldLabelClassName, authInputClassName } from "./styles";

const submitButtonClassName =
  "flex w-full cursor-pointer items-center justify-center rounded-xl bg-azure px-4.5 py-3.25 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70";

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
