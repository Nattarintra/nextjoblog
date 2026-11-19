import { Alert } from "@/components/ui/Alert";

export function LoginLoggedOutAlert({ message }: { message: string }) {
  return (
    <Alert tone="success" className="mb-4" data-testid="login-logged-out">
      {message}
    </Alert>
  );
}

export function LoginErrorAlert({ message }: { message: string }) {
  return (
    <Alert tone="danger" className="mb-4" data-testid="login-alert">
      {message}
    </Alert>
  );
}

export function LoginConfirmationRequiredAlert() {
  return (
    <Alert tone="warning" role="alert" className="mb-4" data-testid="login-alert">
      Please verify your email before logging in. Check your inbox for the verification link.
    </Alert>
  );
}
