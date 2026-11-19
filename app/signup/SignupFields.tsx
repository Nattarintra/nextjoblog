import type { ComponentProps } from "react";

import { PasswordField } from "./PasswordField";
import { Button } from "@/components/ui/Button";
import { controlClassName, LABEL_CLASS } from "@/components/ui/control-styles";

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
        <label htmlFor="email" className={LABEL_CLASS}>
          Email
        </label>
        <input className={controlClassName(false)} id="email" name="email" type="email" placeholder="you@example.com" required />
      </div>
      <PasswordField message={passwordMessage} />
      <div className="mt-1.5 mb-5" />
      <Button variant="primary" fullWidth type="submit" pending={isPending} pendingLabel="Creating account…">Sign Up</Button>
    </form>
  );
}
