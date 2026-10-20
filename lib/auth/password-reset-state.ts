export type ForgotPasswordFormState =
  | undefined
  | { readonly error: "invalid_email" }
  | { readonly status: "sent"; readonly email: string }
  | { readonly status: "rate_limited"; readonly retryAfterSeconds: number };
