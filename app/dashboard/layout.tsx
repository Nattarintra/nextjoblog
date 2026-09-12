import type { JwtPayload } from "@supabase/auth-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { SessionExpiryNotice } from "./SessionExpiryNotice";

const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

// The production session lifetime is Supabase's 30-day timebox. The e2e
// harness supplies the same value as its short-timebox Supabase project so
// the notice can exercise the proportional boundary without waiting 28 days.
function getSessionLifetimeMs(): number {
  const configuredLifetimeMs = Number(process.env.SESSION_TIMEBOX_MS);

  return Number.isFinite(configuredLifetimeMs) && configuredLifetimeMs > 0
    ? configuredLifetimeMs
    : DEFAULT_SESSION_LIFETIME_MS;
}

// `amr[0].timestamp` is when the session actually began (unlike the 1-hour
// access-token `iat`, which changes on every refresh) — see research.md's
// Key Discoveries. The RFC-8176 string[] form of `amr` carries no timestamp,
// so expiry can't be derived from it.
function computeSessionExpiresAt(claims: JwtPayload | null | undefined): number | undefined {
  const firstAmrEntry = claims?.amr?.[0];

  if (!firstAmrEntry || typeof firstAmrEntry === "string") {
    return undefined;
  }

  return firstAmrEntry.timestamp * 1000 + getSessionLifetimeMs();
}

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const sessionExpiresAt = computeSessionExpiresAt(data?.claims);

  return (
    <>
      {children}
      {sessionExpiresAt !== undefined && <SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />}
    </>
  );
}
