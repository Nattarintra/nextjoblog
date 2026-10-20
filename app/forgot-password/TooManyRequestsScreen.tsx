import Link from "next/link";
import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { ClockStatusIcon } from "@/components/auth/AuthStatusIcons";
import {
  authFooterClassName,
  authHeadingClassName,
  authSubtextClassName,
  secondaryButtonClassName,
  statusRingClassName,
  submitButtonClassName,
  visuallyHiddenClassName,
  waitCardClassName,
  waitLabelClassName,
  waitNoteClassName,
  waitTimeClassName,
  warningStatusRingClassName,
} from "@/components/auth/styles";
import { useCountdown } from "@/lib/hooks/use-countdown";

export default function TooManyRequestsScreen({
  email,
  retryAfterSeconds,
  action,
  isPending,
}: {
  email: string;
  retryAfterSeconds: number;
  action: ComponentProps<"form">["action"];
  isPending: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { formatted, isFinished } = useCountdown(retryAfterSeconds);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <AuthLogo />
      <div className={`${statusRingClassName} ${warningStatusRingClassName}`} aria-hidden="true">
        <ClockStatusIcon className="h-7 w-7" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className={authHeadingClassName}>Too Many Reset Requests</h1>
      <div className={authSubtextClassName} role="alert">
        Please wait before requesting another reset link.
      </div>

      <div className={waitCardClassName}>
        <div className={waitLabelClassName}>You can try again in</div>
        <div className={waitTimeClassName} aria-hidden="true">{formatted}</div>
        <div className={visuallyHiddenClassName} aria-live="polite">
          {isFinished ? "You can request a new reset link now." : ""}
        </div>
        <div className={waitNoteClassName}>Any link already sent will still work.</div>
      </div>

      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <button className={`${secondaryButtonClassName} mb-2.5`} type="submit" disabled={isPending || !isFinished}>
          Request a New Link
        </button>
      </form>
      <Link className={submitButtonClassName} href="/login">Back to Log In</Link>

      <div className={authFooterClassName}>Same message for every email address</div>
    </>
  );
}
