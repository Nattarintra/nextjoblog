import { NextResponse } from "next/server";

import { buildLoginRedirectUrl } from "@/lib/auth/login-redirect";
import { resolvePostLoginPath } from "@/lib/auth/next-path";
import { AUTH_REDIRECT_CACHE_CONTROL } from "@/lib/auth/paths";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<Response> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Failed to sign out expired session:", error);
  }

  const next = resolvePostLoginPath(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(
    new URL(buildLoginRedirectUrl(next), request.url),
  );
  response.headers.set("Cache-Control", AUTH_REDIRECT_CACHE_CONTROL);
  return response;
}
