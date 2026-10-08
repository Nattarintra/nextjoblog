import { createServerClient, isChunkLike } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  getSupabaseAuthCookieStorageKey,
  getSupabaseConfig,
  SupabaseConfigError,
} from "@/lib/supabase/config";
import { createAuthRedirect } from "@/lib/auth/redirect-response";
import { REQUEST_PATH_HEADER } from "@/lib/auth/request-path";
import { decideRouteAccess } from "@/lib/auth/route-access";
import { classifyClaimsResult, classifyThrown } from "@/lib/auth/session-state";

function requestSearchWithoutRsc(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("_rsc");
  const result = params.toString();
  return result === "" ? "" : `?${result}`;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const search = requestSearchWithoutRsc(request.nextUrl.search);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_PATH_HEADER, `${pathname}${search}`);
  const forwardedRequest = { request: { headers: requestHeaders } };
  let response = NextResponse.next(forwardedRequest);

  let config;
  try {
    config = getSupabaseConfig();
  } catch (error) {
    if (!(error instanceof SupabaseConfigError)) {
      throw error;
    }

    // Fail open: pass the request through unauthenticated rather than
    // exposing provider credentials or a stack trace to the browser. Server
    // Actions independently validate configuration on the render tier.
    console.error("Supabase configuration invalid", {
      event: "supabase_config_invalid",
      reason: error.reason,
    });
    return response;
  }

  // Matching the request-time URL's hostname derivation (rather than a fixed
  // literal name) is what lets us find every auth cookie to clear, chunked
  // or not. See getSupabaseAuthCookieStorageKey for the formula contract.
  const authCookieStorageKey = getSupabaseAuthCookieStorageKey(config.url);

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next(forwardedRequest);

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  let authState;
  try {
    const { data, error } = await supabase.auth.getClaims();
    authState = classifyClaimsResult({ data, error });
  } catch (error) {
    authState = classifyThrown(error);
  }

  // A confirmed-expired session (GoTrue's `session_expired`, i.e. the
  // timebox was exceeded) was a real session that is now dead — clear its
  // cookies so the browser stops presenting it. A missing/corrupted session
  // (no error, or any other error shape) has nothing meaningful to clear and
  // must not surface as an error; it just falls through as logged-out.
  if (authState.kind === "unauthenticated" && authState.reason === "expired") {
    request.cookies
      .getAll()
      .filter(({ name }) => isChunkLike(name, authCookieStorageKey))
      .forEach(({ name }) => response.cookies.delete(name));
  }

  const decision = decideRouteAccess({
    pathname,
    search,
    authState: authState.kind,
  });

  return decision.action === "redirect"
    ? createAuthRedirect(decision.location, request.url, response)
    : response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
