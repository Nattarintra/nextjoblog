import Link from "next/link";
import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

import { AuthLogo } from "@/components/auth/AuthLogo";
import {
  authFieldLabelClassName,
  authFooterClassName,
  authHeadingClassName,
  authHintClassName,
  authInputClassName,
  authLinkClassName,
  authSubtextClassName,
  submitButtonClassName,
} from "@/components/auth/styles";

export default function ForgotPasswordForm({
  action,
  isPending,
  hasError,
  onSubmit,
}: {
  action: ComponentProps<"form">["action"];
  isPending: boolean;
  hasError: boolean;
  onSubmit: (email: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <AuthLogo />
      <h1 ref={headingRef} tabIndex={-1} className={authHeadingClassName}>
        Forgot Your Password?
      </h1>
      <div className={authSubtextClassName}>Enter your email and we&apos;ll send you a secure reset link.</div>

      <form
        action={action}
        noValidate
        onSubmit={(event) => {
          const value = new FormData(event.currentTarget).get("email");
          if (typeof value === "string") onSubmit(value.trim());
        }}
      >
        <div className="mb-3.5">
          <label htmlFor="forgot-password-email" className={authFieldLabelClassName}>
            Email
          </label>
          <input
            className={authInputClassName}
            id="forgot-password-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            aria-invalid={hasError}
            aria-describedby={hasError ? "forgot-password-email-error" : undefined}
          />
          {hasError && (
            <p id="forgot-password-email-error" className="mt-1.5 text-[12px] text-auth-danger" role="alert">
              Enter a valid email address, like you@example.com
            </p>
          )}
        </div>
        <p className={authHintClassName}>The link works once. You&apos;ll set your new password on the page it opens.</p>
        <button className={`${submitButtonClassName} mt-5`} type="submit" disabled={isPending}>
          {isPending ? "Sending reset link…" : "Send Reset Link"}
        </button>
      </form>

      <div className={authFooterClassName}>
        <Link className={authLinkClassName} href="/login">← Back to Log In</Link>
      </div>
    </>
  );
}
