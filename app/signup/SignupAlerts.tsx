import { AuthLink } from "@/components/auth/AuthFooter";
import { Alert } from "@/components/ui/Alert";
import { LOGIN_PATH } from "@/lib/auth/paths";

export function DuplicateEmailAlert() {
  return (
    <Alert tone="warning" role="alert" className="mb-4" data-testid="signup-alert">
      This email is already in use — <AuthLink className="underline" href={LOGIN_PATH}>Log In</AuthLink> instead
    </Alert>
  );
}

export function UnknownErrorAlert({ message }: { message: string }) {
  return (
    <Alert tone="danger" className="mb-4" data-testid="signup-alert">
      {message}
    </Alert>
  );
}

export function ConfirmationRequiredAlert() {
  return (
    <Alert tone="warning" role="alert" className="mb-4" data-testid="signup-alert">
      Your account was created — check your email to verify it before you{" "}
      <AuthLink className="underline" href={LOGIN_PATH}>Log In</AuthLink>
    </Alert>
  );
}

export function ConfigurationErrorAlert() {
  return (
    <Alert tone="danger" className="mb-4" data-testid="signup-alert">
      We&apos;re unable to create accounts right now. Please try again shortly.
    </Alert>
  );
}
