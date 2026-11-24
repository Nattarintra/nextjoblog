"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { extendSession, type ExtendSessionState } from "@/app/actions/session";
import { SESSION_EXTENSION_MESSAGES } from "@/app/actions/session-messages";
import { OFFLINE_ERROR_MESSAGE } from "@/lib/auth/messages";

type SuccessfulExtensionState = { ok: true; extendedUntil: number; cycleToken: string };
type UseSessionExtensionOptions = { cycleToken: string; onSuccess: (extendedUntil: number, cycleToken: string) => void; onStale?: () => void };

function isSuccessfulExtension(state: ExtendSessionState): state is SuccessfulExtensionState {
  return state !== undefined && "ok" in state;
}

function getErrorMessage(clientError: string | null, state: ExtendSessionState): string | null {
  if (clientError) return clientError;
  return state && "error" in state ? state.message : null;
}

// A network failure rejects the server action itself; surface it as a retryable
// error instead of letting it escape useActionState.
async function extendSessionSafely(previous: ExtendSessionState, formData?: FormData): Promise<ExtendSessionState> {
  try {
    return await extendSession(previous, formData);
  } catch {
    return { error: "unknown", message: SESSION_EXTENSION_MESSAGES.failure };
  }
}

export function useSessionExtension({ cycleToken, onSuccess, onStale }: UseSessionExtensionOptions) {
  const router = useRouter();
  const [state, extendAction, isPending] = useActionState(extendSessionSafely, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  useEffect(() => {
    if (!isSuccessfulExtension(state)) return;
    onSuccess(state.extendedUntil, state.cycleToken); router.refresh();
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
