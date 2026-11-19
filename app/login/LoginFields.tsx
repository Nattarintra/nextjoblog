import type { ComponentProps } from "react";

import { Button } from "@/components/ui/Button";
import { controlClassName, LABEL_CLASS } from "@/components/ui/control-styles";
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
      <div className="mb-3.5">
        <label htmlFor="email" className={LABEL_CLASS}>
          Email
        </label>
        <input
          className={controlClassName(hasError)}
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          aria-invalid={hasError}
        />
      </div>
      <div className="mb-3.5">
        <label htmlFor="password" className={LABEL_CLASS}>
          Password
        </label>
        <input
          className={controlClassName(hasError)}
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          aria-invalid={hasError}
        />
      </div>
      {forgotPasswordEnabled && (
        <div className="mb-5 text-right">
          <AuthLink href={FORGOT_PASSWORD_PATH}>{LOGIN_MESSAGES.forgotPassword}</AuthLink>
        </div>
      )}
      <Button variant="primary" fullWidth type="submit" pending={isPending} pendingLabel="Logging in…">{LOGIN_MESSAGES.submit}</Button>
    </form>
  );
}
