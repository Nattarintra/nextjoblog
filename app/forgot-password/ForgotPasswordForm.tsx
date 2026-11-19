import type { ComponentProps } from "react";
import { AuthFooter, AuthLink } from "@/components/auth/AuthFooter";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { Button } from "@/components/ui/Button";
import { controlClassName, LABEL_CLASS } from "@/components/ui/control-styles";
import { FORGOT_MESSAGES } from "@/lib/auth/messages";
import { LOGIN_PATH } from "@/lib/auth/paths";

export default function ForgotPasswordForm({ action, isPending, hasError, onSubmit }: { action: ComponentProps<"form">["action"]; isPending: boolean; hasError: boolean; onSubmit: (email: string) => void }) {
  return <>
    <AuthHeader title={FORGOT_MESSAGES.heading} subtitle={FORGOT_MESSAGES.subtitle} focusHeading />
    <form action={action} noValidate onSubmit={(event) => { const value = new FormData(event.currentTarget).get("email"); if (typeof value === "string") onSubmit(value.trim()); }}>
      <div className="mb-4 flex flex-col gap-1.5">
        <label htmlFor="forgot-password-email" className={LABEL_CLASS}>Email</label>
        <input className={controlClassName(hasError)} id="forgot-password-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required aria-invalid={hasError} aria-describedby={hasError ? "forgot-password-email-error" : undefined} />
        {hasError && <p id="forgot-password-email-error" className="text-[13.5px] font-medium text-(--surface-error-text)" role="alert">{FORGOT_MESSAGES.invalidEmail}</p>}
      </div>
      <p className="mt-4 text-[13.5px] leading-relaxed text-on-dark-3">{FORGOT_MESSAGES.hint}</p>
      <div className="mt-5"><Button variant="primary" fullWidth type="submit" pending={isPending} pendingLabel="Sending reset link…">{FORGOT_MESSAGES.submit}</Button></div>
    </form>
    <AuthFooter><AuthLink href={LOGIN_PATH}>{FORGOT_MESSAGES.backToLogin}</AuthLink></AuthFooter>
  </>;
}
