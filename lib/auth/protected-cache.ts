import type { NextResponse } from "next/server";

import { PROTECTED_CACHE_CONTROL } from "@/lib/auth/paths";
import { isPublicPath } from "@/lib/auth/route-access";

export function applyProtectedCacheControl(
  response: NextResponse,
  pathname: string,
): NextResponse {
  if (!isPublicPath(pathname)) {
    response.headers.set("Cache-Control", PROTECTED_CACHE_CONTROL);
  }
  return response;
}
