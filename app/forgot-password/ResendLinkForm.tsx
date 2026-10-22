import type { ComponentProps } from "react";

import { RESEND_COOLDOWN_SECONDS } from "@/lib/auth/password-reset-config";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { secondaryButtonClassName } from "@/components/auth/styles";

export default function ResendLinkForm({
  email,
  action,
  isPending,
}: {
  email: string;
  action: ComponentProps<"form">["action"];
  isPending: boolean;
}) {
  const { formatted, isFinished } = useCountdown(RESEND_COOLDOWN_SECONDS);

  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button className={secondaryButtonClassName} type="submit" disabled={isPending || !isFinished}>
        {isFinished ? "Resend Link" : `Resend Link in ${formatted}`}
      </button>
    </form>
  );
}
