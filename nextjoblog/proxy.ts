import { isAuthApiError } from "@supabase/auth-js";
import { createServerClient, isChunkLike } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// `@supabase/supabase-js` derives its cookie storage key from the project
// URL's hostname (e.g. `sb-127-auth-token` locally, `sb-<ref>-auth-token`
// hosted) when no explicit `cookieOptions.name` is configured, which this app
// does not set. Matching that derivation (rather than a fixed literal name)
// is what lets us find every auth cookie to clear, chunked or not.
const authCookieStorageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.getClaims();

  // A confirmed-expired session (GoTrue's `session_expired`, i.e. the
  // timebox was exceeded) was a real session that is now dead — clear its
  // cookies so the browser stops presenting it. A missing/corrupted session
  // (no error, or any other error shape) has nothing meaningful to clear and
  // must not surface as an error; it just falls through as logged-out.
  if (isAuthApiError(error) && error.code === "session_expired") {
    request.cookies
      .getAll()
      .filter(({ name }) => isChunkLike(name, authCookieStorageKey))
      .forEach(({ name }) => response.cookies.delete(name));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
