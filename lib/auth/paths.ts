export const LOGIN_PATH = "/login";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const DEFAULT_POST_LOGIN_PATH = "/dashboard";
export const NEXT_PARAM_NAME = "next";
export const MAX_NEXT_LENGTH = 2048;

export const AUTH_PATH_PREFIXES = [
  "/login",
  "/signup",
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  "/api/auth",
] as const;

export const PUBLIC_PATH_PREFIXES = AUTH_PATH_PREFIXES;
export const SESSION_EXPIRED_PATH = "/api/auth/session-expired";
export const AUTH_REDIRECT_CACHE_CONTROL = "private, no-store, max-age=0";
export const LOGGED_OUT_PARAM_NAME = "loggedOut";
export const LOGGED_OUT_PARAM_VALUE = "1";
export const PROTECTED_CACHE_CONTROL = AUTH_REDIRECT_CACHE_CONTROL;
export const LOGOUT_API_PATH = "/api/auth/logout";
