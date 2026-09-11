import type { JwtPayload } from "@supabase/auth-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

// `amr[0].timestamp` is when the session actually began (unlike the 1-hour
// access-token `iat`, which changes on every refresh) — see research.md's
// Key Discoveries. The RFC-8176 string[] form of `amr` carries no timestamp,
// so expiry can't be derived from it.
function computeSessionExpiresAt(claims: JwtPayload | null | undefined): number | undefined {
  const firstAmrEntry = claims?.amr?.[0];

  if (!firstAmrEntry || typeof firstAmrEntry === "string") {
    return undefined;
  }

  return firstAmrEntry.timestamp * 1000 + SESSION_LIFETIME_MS;
}

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  // Consumed by SessionExpiryNotice once it's wired in here (Phase 4).
  const sessionExpiresAt = computeSessionExpiresAt(data?.claims);

  return <>{children}</>;
}
