export const PASSWORD_RESET_FRAGMENT_KEYS = {
  accessToken: "access_token",
  refreshToken: "refresh_token",
  type: "type",
  errorCode: "error_code",
} as const;

export const RECOVERY_FLOW_TYPE = "recovery";
export const PASSWORD_UPDATED_TOAST_FLAG = "password_updated";
export const PASSWORD_UPDATED_TOAST_COOKIE_MAX_AGE_SECONDS = 60;
export const PASSWORD_UPDATED_TOAST_DISMISS_MS = 5_000;
