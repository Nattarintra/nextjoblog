import {
  LOGGED_OUT_PARAM_NAME,
  LOGGED_OUT_PARAM_VALUE,
  LOGIN_PATH,
  NEXT_PARAM_NAME,
  SESSION_EXPIRED_PATH,
} from "@/lib/auth/paths";
import { resolvePostLoginPath } from "@/lib/auth/next-path";

function buildRedirectUrl(path: string, requestedPath: string): string {
  const safePath = resolvePostLoginPath(requestedPath);
  return `${path}?${NEXT_PARAM_NAME}=${encodeURIComponent(safePath)}`;
}

export function buildLoginRedirectUrl(requestedPath: string): string {
  return buildRedirectUrl(LOGIN_PATH, requestedPath);
}

export function buildSessionExpiredUrl(requestedPath: string): string {
  return buildRedirectUrl(SESSION_EXPIRED_PATH, requestedPath);
}

export function buildLoggedOutLoginUrl(): string {
  return `${LOGIN_PATH}?${LOGGED_OUT_PARAM_NAME}=${LOGGED_OUT_PARAM_VALUE}`;
}
