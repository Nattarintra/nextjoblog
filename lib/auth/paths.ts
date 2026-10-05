export const LOGIN_PATH = "/login";
export const DEFAULT_POST_LOGIN_PATH = "/dashboard";
export const NEXT_PARAM_NAME = "next";
export const MAX_NEXT_LENGTH = 2048;

export const AUTH_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
] as const;

export const PUBLIC_PATH_PREFIXES = AUTH_PATH_PREFIXES;
export const SESSION_EXPIRED_PATH = "/api/auth/session-expired";
export const AUTH_REDIRECT_CACHE_CONTROL = "private, no-store, max-age=0";
