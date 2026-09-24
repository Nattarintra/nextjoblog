export type SupabaseConfigFailureReason =
  | "missing_url"
  | "invalid_url"
  | "missing_anon_key";

const SUPABASE_CONFIG_FAILURE_MESSAGES: Record<SupabaseConfigFailureReason, string> = {
  missing_url: "NEXT_PUBLIC_SUPABASE_URL is not set.",
  invalid_url: "NEXT_PUBLIC_SUPABASE_URL is not a valid http(s) URL.",
  missing_anon_key: "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.",
};

// Safe to log as-is: carries only a stable reason code and a message
// derived from that code, never an environment value.
export class SupabaseConfigError extends Error {
  readonly reason: SupabaseConfigFailureReason;

  constructor(reason: SupabaseConfigFailureReason) {
    super(SUPABASE_CONFIG_FAILURE_MESSAGES[reason]);
    this.name = "SupabaseConfigError";
    this.reason = reason;
  }
}

export interface SupabaseRuntimeConfig {
  readonly url: string;
  readonly anonKey: string;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolves and validates the public Supabase runtime configuration.
 *
 * Re-reads and re-validates `process.env` on every call — never cache the
 * result at module scope. Proxy can run on a separate execution tier from
 * render-time Server Actions in an optimized deployment (see Next's Proxy
 * file-convention docs), so module-level state here would not reliably be
 * shared between the two call sites that use this getter.
 */
export function getSupabaseConfig(): SupabaseRuntimeConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new SupabaseConfigError("missing_url");
  }

  if (!isHttpUrl(url)) {
    throw new SupabaseConfigError("invalid_url");
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new SupabaseConfigError("missing_anon_key");
  }

  return { url, anonKey };
}

/**
 * Derives the `@supabase/ssr` cookie storage key from the project URL's
 * hostname (e.g. `sb-127-auth-token` locally, `sb-<ref>-auth-token`
 * hosted) — the library's own default when no explicit `cookieOptions.name`
 * is configured, which this app does not set.
 *
 * `e2e/session-expiry.spec.ts` independently re-implements this exact
 * formula to decode auth cookies; any change here must stay byte-for-byte
 * identical to it for a given valid URL.
 */
export function getSupabaseAuthCookieStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}
