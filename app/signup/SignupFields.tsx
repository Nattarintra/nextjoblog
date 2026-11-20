import type { ComponentProps } from "react";

import { PasswordField } from "./PasswordField";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { SIGNUP_MESSAGES } from "@/lib/auth/messages";

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
      <FormField name="email" id="email" label={SIGNUP_MESSAGES.emailLabel} required>
        <TextInput type="email" placeholder="you@example.com" />
      </FormField>
      <PasswordField message={passwordMessage} />
      <div className="mt-1.5 mb-5" />
      <Button variant="primary" fullWidth type="submit" pending={isPending} pendingLabel={SIGNUP_MESSAGES.pendingSubmit}>{SIGNUP_MESSAGES.submit}</Button>
    </form>
  );
}
