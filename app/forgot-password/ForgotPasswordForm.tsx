import type { ComponentProps } from "react";
import { AuthFooter, AuthLink } from "@/components/auth/AuthFooter";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";
import { FORGOT_MESSAGES } from "@/lib/auth/messages";
import { LOGIN_PATH } from "@/lib/auth/paths";

export default function ForgotPasswordForm({ action, isPending, hasError, onSubmit }: { action: ComponentProps<"form">["action"]; isPending: boolean; hasError: boolean; onSubmit: (email: string) => void }) {
  return <>
    <AuthHeader title={FORGOT_MESSAGES.heading} subtitle={FORGOT_MESSAGES.subtitle} focusHeading />
    <form action={action} noValidate onSubmit={(event) => { const value = new FormData(event.currentTarget).get("email"); if (typeof value === "string") onSubmit(value.trim()); }}>
      <FormField name="email" id="forgot-password-email" label={FORGOT_MESSAGES.emailLabel} required error={hasError ? FORGOT_MESSAGES.invalidEmail : undefined}>
        <TextInput type="email" placeholder="you@example.com" autoComplete="email" />
      </FormField>
      <p className="mt-4 text-[13.5px] leading-relaxed text-on-dark-3">{FORGOT_MESSAGES.hint}</p>
      <div className="mt-5"><Button variant="primary" fullWidth type="submit" pending={isPending} pendingLabel={FORGOT_MESSAGES.pendingSubmit}>{FORGOT_MESSAGES.submit}</Button></div>
    </form>
    <AuthFooter><AuthLink href={LOGIN_PATH}>{FORGOT_MESSAGES.backToLogin}</AuthLink></AuthFooter>
  </>;
}
