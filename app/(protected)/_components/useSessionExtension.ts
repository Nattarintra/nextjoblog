"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { extendSession, type ExtendSessionState } from "@/app/actions/session";
import { OFFLINE_ERROR_MESSAGE } from "@/lib/auth/messages";

type SuccessfulExtensionState = { ok: true; extendedUntil: number };
type UseSessionExtensionOptions = { cycleToken: string; onSuccess: (extendedUntil: number) => void; onStale?: () => void };

function isSuccessfulExtension(state: ExtendSessionState): state is SuccessfulExtensionState {
  return state !== undefined && "ok" in state;
}

function getErrorMessage(clientError: string | null, state: ExtendSessionState): string | null {
  if (clientError) return clientError;
  return state && "error" in state ? state.message : null;
}

export function useSessionExtension({ cycleToken, onSuccess, onStale }: UseSessionExtensionOptions) {
  const router = useRouter();
  const [state, extendAction, isPending] = useActionState(extendSession, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  useEffect(() => {
    if (!isSuccessfulExtension(state)) return;
    onSuccess(state.extendedUntil); router.refresh();
    // A stale action is reconciled separately so it never looks like a retryable error.
  }, [onSuccess, router, state]);
  useEffect(() => {
    if (!state || !("error" in state) || state.error !== "stale") return;
    onStale?.();
    router.refresh();
  }, [onStale, router, state]);
  function extend(): void {
    if (!navigator.onLine) { setClientError(OFFLINE_ERROR_MESSAGE); return; }
    setClientError(null); startTransition(() => { const data = new FormData(); data.set("cycleToken", cycleToken); (extendAction as unknown as (payload: FormData) => void)(data); });
  }
  return { errorMessage: getErrorMessage(clientError, state), extend, isPending };
}
