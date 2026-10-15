import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { logAuthEvent } from "@/lib/auth/log";
import { createLogout } from "@/lib/auth/logout";
import { PROTECTED_CACHE_CONTROL } from "@/lib/auth/paths";
import { applyTestLogoutOverride, TEST_LOGOUT_COOKIE } from "@/lib/auth/test-hooks";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// A Route Handler, not a Server Action: an action's cookie-mutation re-render
// re-runs the page guard and its redirect races the client's router.replace.
const logout = createLogout({
  createClient: createServerSupabaseClient,
  log: logAuthEvent,
  forcedOutcome: async () => {
    const cookieStore = await cookies();
    return applyTestLogoutOverride({
      env: { NODE_ENV: process.env.NODE_ENV, E2E_TEST_HOOKS: process.env.E2E_TEST_HOOKS },
      cookieValue: cookieStore.get(TEST_LOGOUT_COOKIE)?.value,
    });
  },
});

export async function POST(): Promise<Response> {
  const state = await logout(undefined);
  return NextResponse.json(state ?? null, {
    headers: { "Cache-Control": PROTECTED_CACHE_CONTROL },
  });
}
