import { NextResponse } from "next/server";

import { AUTH_REDIRECT_CACHE_CONTROL } from "@/lib/auth/paths";

export function createAuthRedirect(
  location: string,
  requestUrl: string,
  source: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(new URL(location, requestUrl), 307);

  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  redirect.headers.set("Cache-Control", AUTH_REDIRECT_CACHE_CONTROL);
  return redirect;
}
