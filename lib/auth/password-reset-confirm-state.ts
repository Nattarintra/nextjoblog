export type PasswordResetConfirmState =
  | undefined
  | { status: "updated" }
  | { status: "too_short" }
  | { status: "mismatch" }
  | { status: "offline" }
  | { status: "same_password" }
  | { status: "network" }
  | { status: "expired" }
  | { status: "unknown" };
