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

export const PASSWORD_RESET_FORM_FIELDS = {
  accessToken: "access_token",
  refreshToken: "refresh_token",
  password: "password",
  confirmation: "confirmation",
} as const;

export const PASSWORD_UPDATED_TOAST_FLAG_VALUE = "1";
export const PASSWORD_UPDATED_TOAST_COOKIE_PATH = "/";
export const PASSWORD_UPDATED_TOAST_COOKIE_SAME_SITE = "lax";

// Defensive cap on every form field the reset action accepts (tokens are the
// longest values); anything larger is not a real reset submission.
export const PASSWORD_RESET_MAX_FIELD_LENGTH = 8_192;
