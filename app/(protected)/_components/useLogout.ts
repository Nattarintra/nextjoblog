"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { buildLoggedOutLoginUrl } from "@/lib/auth/login-redirect";
import {
  getLogoutFailure,
  isLogoutSuccess,
  LOGOUT_FAILURES,
} from "@/lib/auth/logout-state";
import type { LogoutState } from "@/lib/auth/logout-state";
import { LOGOUT_API_PATH } from "@/lib/auth/paths";

type LogoutRequest = () => Promise<LogoutState>;

export type LogoutControl = {
  logout: () => void;
  errorMessage: string | null;
  isPending: boolean;
};


async function postLogout(): Promise<LogoutState> {
  try {
    const response = await fetch(LOGOUT_API_PATH, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return LOGOUT_FAILURES.unknown;
    const body = (await response.json()) as LogoutState | null;
    return body ?? LOGOUT_FAILURES.unknown;
  } catch {
    return LOGOUT_FAILURES.unknown;
  }
}

export function useLogout(request: LogoutRequest = postLogout): LogoutControl {
  const [state, setState] = useState<LogoutState>(undefined);
  const [isRequesting, setIsRequesting] = useState(false);
  const inFlight = useRef(false);
  const loggedOut = isLogoutSuccess(state);

  useEffect(() => {
    // A full navigation, not router.replace: Next reuses cached pages on
    // Back/Forward and a Route Handler's cookie change does not clear that
    // client cache, so Back would otherwise show a cached authenticated page.
    if (loggedOut) window.location.replace(buildLoggedOutLoginUrl());
  }, [loggedOut]);

  const logout = useCallback(async (): Promise<void> => {
    if (inFlight.current || loggedOut) return;
    if (!navigator.onLine) {
      setState(LOGOUT_FAILURES.offline);
      return;
    }
    inFlight.current = true;
    setState(undefined);
    setIsRequesting(true);
    try {
      setState(await request());
    } finally {
      inFlight.current = false;
      setIsRequesting(false);
    }
  }, [loggedOut, request]);

  return {
    logout,
    errorMessage: getLogoutFailure(state)?.message ?? null,
    // Stays true after success until navigation so the button cannot be re-clicked.
    isPending: isRequesting || loggedOut,
  };
}
