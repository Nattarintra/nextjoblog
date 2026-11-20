import { ButtonLink } from "@/components/ui/Button";
import { AuthFooter } from "@/components/auth/AuthFooter";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { LinkBrokenStatusIcon } from "@/components/auth/AuthStatusIcons";
import { StatusSteps } from "@/components/auth/StatusSteps";
import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/lib/auth/paths";

export default function ResetLinkExpiredScreen() {
  const { expired } = PASSWORD_RESET_MESSAGES;
  return <AuthStatusScreen tone="danger" icon={<LinkBrokenStatusIcon className="h-7 w-7" />} heading={expired.heading} description={expired.description} liveRegion="alert">
    <StatusSteps steps={expired.steps} />
    <div className="mt-6 grid gap-2.5"><ButtonLink variant="primary" fullWidth href={FORGOT_PASSWORD_PATH}>{expired.requestLink}</ButtonLink><ButtonLink variant="secondary" fullWidth href={LOGIN_PATH}>{expired.backToLogin}</ButtonLink></div>
    <AuthFooter small>{expired.footnote}</AuthFooter>
  </AuthStatusScreen>;
}
