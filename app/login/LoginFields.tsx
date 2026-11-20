import type { ComponentProps } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { AuthLink } from "@/components/auth/AuthFooter";
import { LOGIN_MESSAGES } from "@/lib/auth/messages";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/paths";

export function LoginFields({
  formAction,
  hasError,
  isPending,
  nextPath,
  forgotPasswordEnabled = true,
}: {
  formAction: ComponentProps<"form">["action"];
  hasError: boolean;
  isPending: boolean;
  nextPath: string;
  forgotPasswordEnabled?: boolean;
}) {
  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={nextPath} />
      <FormField name="email" id="email" label={LOGIN_MESSAGES.emailLabel} required invalid={hasError}>
        <TextInput type="email" placeholder="you@example.com" />
      </FormField>
      <FormField name="password" id="password" label={LOGIN_MESSAGES.passwordLabel} required invalid={hasError}>
        <TextInput type="password" placeholder="••••••••" />
      </FormField>
      {forgotPasswordEnabled && (
        <div className="mb-5 text-right">
          <AuthLink href={FORGOT_PASSWORD_PATH}>{LOGIN_MESSAGES.forgotPassword}</AuthLink>
        </div>
      )}
      <Button variant="primary" fullWidth type="submit" pending={isPending} pendingLabel={LOGIN_MESSAGES.pendingSubmit}>{LOGIN_MESSAGES.submit}</Button>
    </form>
  );
}
