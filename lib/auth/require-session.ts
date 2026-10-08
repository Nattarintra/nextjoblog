import type { JwtPayload } from "@supabase/auth-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { buildLoginRedirectUrl, buildSessionExpiredUrl } from "@/lib/auth/login-redirect";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getRequestPath } from "@/lib/auth/request-path";
import { applyTestSessionOverride, TEST_SESSION_CHECK_COOKIE } from "@/lib/auth/test-hooks";
import { getEffectiveSessionExpiry, isSessionExpired } from "@/lib/session";
import type { EffectiveSessionExpiry } from "@/lib/session";

type AuthenticatedSession = {
  status: "authenticated";
  claims: JwtPayload;
  effectiveExpiresAt: number;
};

export type RequiredSession =
  | AuthenticatedSession
  | { status: "verification_failed"; loginHref: string };

type Dependencies = {
  getSessionState: () => Promise<EffectiveSessionExpiry>;
  getRequestPath: () => Promise<string | undefined>;
  redirect: (url: string) => never;
  now?: () => number;
};

export function createRequireSession(deps: Dependencies): () => Promise<RequiredSession> {
  return async () => {
    const requestedPath = await deps.getRequestPath();
    const state = await deps.getSessionState();
    const path = requestedPath;

    if (state.status === "verification_failed") {
      return {
        status: "verification_failed",
        loginHref: path === undefined ? LOGIN_PATH : buildLoginRedirectUrl(path),
      };
    }

    if (state.status === "unauthenticated") {
      deps.redirect(path === undefined ? LOGIN_PATH : buildLoginRedirectUrl(path));
    }

    if (isSessionExpired(state.effectiveExpiresAt, deps.now?.() ?? Date.now())) {
      deps.redirect(path === undefined ? LOGIN_PATH : buildSessionExpiredUrl(path));
    }

    return state;
  };
}

async function getDefaultSessionState(): Promise<EffectiveSessionExpiry> {
  const state = await getEffectiveSessionExpiry();
  const cookieStore = await cookies();
  return applyTestSessionOverride(state, {
    env: { NODE_ENV: process.env.NODE_ENV, E2E_TEST_HOOKS: process.env.E2E_TEST_HOOKS },
    cookieValue: cookieStore.get(TEST_SESSION_CHECK_COOKIE)?.value,
  });
}

export const requireSession = cache(
  createRequireSession({
    getSessionState: getDefaultSessionState,
    getRequestPath,
    redirect,
  }),
);
