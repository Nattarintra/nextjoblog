import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { extendSession, type ExtendSessionState } from "@/app/actions/session";

const OFFLINE_ERROR_MESSAGE = "You appear to be offline. Please reconnect and try again.";

type SuccessfulExtensionState = { ok: true; extendedUntil: number };

type UseSessionExtensionOptions = {
  onSuccess: () => void;
};

function isSuccessfulExtension(
  state: ExtendSessionState,
): state is SuccessfulExtensionState {
  return state !== undefined && "ok" in state;
}

function getErrorMessage(
  clientError: string | null,
  state: ExtendSessionState,
): string | null {
  if (clientError) return clientError;
  return state && "error" in state ? state.message : null;
}

export function useSessionExtension({ onSuccess }: UseSessionExtensionOptions) {
  const router = useRouter();
  const [state, extendAction, isPending] = useActionState(extendSession, undefined);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuccessfulExtension(state)) return;

    onSuccess();
    router.refresh();
  }, [onSuccess, router, state]);

  function extend(): void {
    if (!navigator.onLine) {
      setClientError(OFFLINE_ERROR_MESSAGE);
      return;
    }

    setClientError(null);
    startTransition(() => {
      extendAction();
    });
  }

  return {
    errorMessage: getErrorMessage(clientError, state),
    extend,
    isPending,
  };
}
