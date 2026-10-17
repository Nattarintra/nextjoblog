import { NextResponse } from "next/server";

import { createExpiredSessionCleanup } from "@/lib/auth/expired-session";
import { logAuthEvent } from "@/lib/auth/log";
import { buildLoginRedirectUrl } from "@/lib/auth/login-redirect";
import { resolvePostLoginPath } from "@/lib/auth/next-path";
import { AUTH_REDIRECT_CACHE_CONTROL } from "@/lib/auth/paths";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// App-level expiry on a valid session; provider-expiry cookie cleanup is handled in proxy.ts.
const cleanupExpiredSession = createExpiredSessionCleanup({
  createClient: createServerSupabaseClient,
  log: logAuthEvent,
});

export async function GET(request: Request): Promise<Response> {
  await cleanupExpiredSession();

  const next = resolvePostLoginPath(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(
    new URL(buildLoginRedirectUrl(next), request.url),
  );
  response.headers.set("Cache-Control", AUTH_REDIRECT_CACHE_CONTROL);
  return response;
}
