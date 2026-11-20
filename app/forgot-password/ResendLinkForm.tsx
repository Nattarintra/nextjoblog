import type { ComponentProps } from "react";

import { RESEND_COOLDOWN_SECONDS } from "@/lib/auth/password-reset-config";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { Button } from "@/components/ui/Button";
import { FORGOT_MESSAGES } from "@/lib/auth/messages";

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
      <Button variant="secondary" fullWidth type="submit" disabled={isPending || !isFinished}>
        {isFinished ? FORGOT_MESSAGES.sent.resend : FORGOT_MESSAGES.sent.resendIn(formatted)}
      </Button>
    </form>
  );
}
