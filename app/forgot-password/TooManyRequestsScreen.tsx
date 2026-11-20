import Link from "next/link";
import type { ComponentProps } from "react";
import { AuthFooter } from "@/components/auth/AuthFooter";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { ClockStatusIcon } from "@/components/auth/AuthStatusIcons";
import { WaitCard } from "@/components/auth/WaitCard";
import { Button } from "@/components/ui/Button";
import { FORGOT_MESSAGES } from "@/lib/auth/messages";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { useCountdown } from "@/lib/hooks/use-countdown";

export default function TooManyRequestsScreen({ email, retryAfterSeconds, action, isPending }: { email: string; retryAfterSeconds: number; action: ComponentProps<"form">["action"]; isPending: boolean }) {
  const { formatted, isFinished } = useCountdown(retryAfterSeconds);
  const messages = FORGOT_MESSAGES.limited;
  return <AuthStatusScreen tone="warning" icon={<ClockStatusIcon className="h-7 w-7" />} heading={messages.heading} description={messages.description} liveRegion="alert">
    <WaitCard formatted={formatted} finished={isFinished} label={messages.waitLabel} note={messages.waitNote} />
    <form action={action}><input type="hidden" name="email" value={email} /><Button variant="secondary" fullWidth type="submit" disabled={isPending || !isFinished}>{messages.requestNewLink}</Button></form>
    <Link className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border-[1.5px] border-(--surface-secondary-border) bg-(--surface-secondary-bg) px-[18px] py-[13px] text-[15px] font-semibold text-(--surface-secondary-text)" href={LOGIN_PATH}>{FORGOT_MESSAGES.backToLogin}</Link>
    <AuthFooter small>{messages.footnote}</AuthFooter>
  </AuthStatusScreen>;
}
