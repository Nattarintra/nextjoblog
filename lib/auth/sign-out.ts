import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyClaimsResult, classifyThrown } from "@/lib/auth/session-state";
import type { ClaimsState } from "@/lib/auth/session-state";

type ErrorMeta = { code?: string; status?: number };

export type SignOutResult =
  | { kind: "signed_out" }
  | ({ kind: "still_signed_in" } & ErrorMeta)
  | ({ kind: "unconfirmed" } & ErrorMeta);

type SignOutAuth = Pick<SupabaseClient["auth"], "signOut" | "getClaims">;

function extractMeta(error: unknown): ErrorMeta {
  if (typeof error !== "object" || error === null) return {};
  const { code, status } = error as { code?: unknown; status?: unknown };
  return {
    ...(typeof code === "string" ? { code } : {}),
    ...(typeof status === "number" ? { status } : {}),
  };
}

async function recheckSession(auth: SignOutAuth): Promise<ClaimsState> {
  try {
    return classifyClaimsResult(await auth.getClaims());
  } catch (error) {
    return classifyThrown(error);
  }
}

// auth-js may clear local cookies even when signOut returns an error, so the
// error type alone does not tell us whether the session is gone. Re-check.
export async function signOutCurrentSession(auth: SignOutAuth): Promise<SignOutResult> {
  let failure: unknown;

  try {
    const { error } = await auth.signOut({ scope: "local" });
    if (!error) return { kind: "signed_out" };
    failure = error;
  } catch (error) {
    failure = error;
  }

  const meta = extractMeta(failure);
  const state = await recheckSession(auth);

  if (state.kind === "unauthenticated") return { kind: "signed_out" };
  if (state.kind === "authenticated") return { kind: "still_signed_in", ...meta };
  return { kind: "unconfirmed", ...meta };
}
