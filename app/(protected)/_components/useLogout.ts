"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LOGOUT_MESSAGES } from "@/app/actions/logout-messages";
import { OFFLINE_ERROR_MESSAGE } from "@/lib/auth/messages";
import { buildLoggedOutLoginUrl } from "@/lib/auth/login-redirect";
import type { LogoutState } from "@/lib/auth/logout";
import { LOGOUT_API_PATH } from "@/lib/auth/paths";

type LogoutRequest = () => Promise<LogoutState>;

const UNKNOWN_FAILURE: LogoutState = { error: "unknown", message: LOGOUT_MESSAGES.unknown };

async function postLogout(): Promise<LogoutState> {
  try {
    const response = await fetch(LOGOUT_API_PATH, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return UNKNOWN_FAILURE;
    const body = (await response.json()) as LogoutState | null;
    return body ?? UNKNOWN_FAILURE;
  } catch {
    return UNKNOWN_FAILURE;
  }
}

export function useLogout(request: LogoutRequest = postLogout) {
  const router = useRouter();
  const [state, setState] = useState<LogoutState>(undefined);
  const [isRequesting, setIsRequesting] = useState(false);
  const inFlight = useRef(false);
  const loggedOut = state !== undefined && "ok" in state;

  useEffect(() => {
    if (loggedOut) router.replace(buildLoggedOutLoginUrl());
  }, [loggedOut, router]);

  const logout = useCallback(async (): Promise<void> => {
    if (inFlight.current || loggedOut) return;
    if (!navigator.onLine) {
      setState({ error: "unknown", message: OFFLINE_ERROR_MESSAGE });
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
    errorMessage: state && "error" in state ? state.message : null,
    // Stays true after success until navigation so the button cannot be re-clicked.
    isPending: isRequesting || loggedOut,
  };
}
