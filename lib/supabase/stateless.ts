import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Creates a client for short-lived auth operations that must not write a
 * browser or server session as a side effect.
 */
export function createStatelessSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
