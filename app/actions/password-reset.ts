"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getClientIp } from "@/lib/auth/client-ip";
import { isValidEmail, normalizeEmail } from "@/lib/auth/email";
import type { ForgotPasswordFormState } from "@/lib/auth/password-reset-state";
import { SupabaseRateLimiter } from "@/lib/auth/supabase-rate-limiter";
import { requestPasswordReset } from "@/lib/auth/request-password-reset";
import { isValidSiteUrl } from "@/lib/auth/site-url";
import { isE2eHooksEnabled } from "@/lib/auth/test-hooks";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type { ForgotPasswordFormState } from "@/lib/auth/password-reset-state";

export async function requestPasswordResetAction(
  _state: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const value = formData.get("email");
  const email = typeof value === "string" ? normalizeEmail(value) : "";

  if (!isValidEmail(email)) return { error: "invalid_email" };
  if (process.env.PASSWORD_RESET_ENABLED !== "1") {
    return { status: "sent", email };
  }

  try {
    const requestHeaders = await headers();
    const config = getSupabaseConfig();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const hashSecret = process.env.RATE_LIMIT_HASH_SECRET ?? "";
    const enabled = true;
    const e2eTestHooksEnabled = isE2eHooksEnabled({
      NODE_ENV: process.env.NODE_ENV,
      E2E_TEST_HOOKS: process.env.E2E_TEST_HOOKS,
    });

    if (!isValidSiteUrl(siteUrl)) {
      console.error("auth.password_reset.configuration_error", {
        code: siteUrl ? "invalid_site_url" : "missing_site_url",
      });
      return { status: "sent", email };
    }

    const supabase = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const limiter = new SupabaseRateLimiter(supabase);

    const result = await requestPasswordReset(
      {
        limiter,
        supabase,
        schedule: (callback) => after(callback),
        enabled,
        hashSecret,
        siteUrl,
        clock: {
          now: () => Date.now(),
          sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
        },
        log: (event, details) => console.error(event, details ?? {}),
      },
      { email, clientIp: getClientIp(requestHeaders, { e2eTestHooksEnabled }) },
    );

    if (result.status === "rate_limited") return result;
    return { status: "sent", email };
  } catch (error) {
    if (error instanceof Error && error.name === "SupabaseConfigError") {
      console.error("auth.password_reset.configuration_error", { code: "supabase_config" });
    } else {
      console.error("auth.password_reset.unexpected_error", {});
    }
    return { status: "sent", email };
  }
}
