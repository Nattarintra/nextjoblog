import type { ComponentProps } from "react";
import { AuthFooter } from "@/components/auth/AuthFooter";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { EmailChip } from "@/components/auth/EmailChip";
import { MailStatusIcon } from "@/components/auth/AuthStatusIcons";
import { StatusSteps } from "@/components/auth/StatusSteps";
import { ButtonLink } from "@/components/ui/Button";
import { FORGOT_MESSAGES } from "@/lib/auth/messages";
import { LOGIN_PATH } from "@/lib/auth/paths";
import ResendLinkForm from "./ResendLinkForm";

export default function CheckYourEmailScreen({ email, action, isPending, resendGeneration, onUseDifferentEmail }: { email: string; action: ComponentProps<"form">["action"]; isPending: boolean; resendGeneration: number; onUseDifferentEmail: () => void }) {
  return <AuthStatusScreen tone="info" icon={<MailStatusIcon className="h-7 w-7" />} heading={FORGOT_MESSAGES.sent.heading} description={FORGOT_MESSAGES.sent.status}>
    <EmailChip email={email} />
    <StatusSteps steps={FORGOT_MESSAGES.sent.steps} />
    <div className="mt-6 grid gap-2.5"><ButtonLink variant="primary" fullWidth href={LOGIN_PATH}>{FORGOT_MESSAGES.backToLogin}</ButtonLink><ResendLinkForm key={resendGeneration} email={email} action={action} isPending={isPending} /></div>
    <AuthFooter><button className="text-sm text-sky underline-offset-4 hover:underline" type="button" onClick={onUseDifferentEmail}>{FORGOT_MESSAGES.sent.differentEmail}</button></AuthFooter>
  </AuthStatusScreen>;
}
