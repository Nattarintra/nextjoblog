import { buildLoginRedirectUrl } from "@/lib/auth/login-redirect";
import { PUBLIC_PATH_PREFIXES } from "@/lib/auth/paths";

export type AuthState =
  | "authenticated"
  | "unauthenticated"
  | "verification_failed";

export type RouteDecision =
  | { action: "allow" }
  | { action: "redirect"; location: string };

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function decideRouteAccess(input: {
  pathname: string;
  search: string;
  authState: AuthState;
}): RouteDecision {
  if (isPublicPath(input.pathname) || input.authState !== "unauthenticated") {
    return { action: "allow" };
  }

  return {
    action: "redirect",
    location: buildLoginRedirectUrl(`${input.pathname}${input.search}`),
  };
}
