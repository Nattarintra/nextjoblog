import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Anon-key client for signing in as a user. It never persists a session, so
// it cannot leak auth state between tests in the same worker.
export const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

export const E2E_TEST_PASSWORD = "abcdef";

export type ConfirmedE2EUser = {
  id: string;
  email: string;
  password: string;
};

export async function createConfirmedE2EUser(label: string): Promise<ConfirmedE2EUser> {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = E2E_TEST_PASSWORD;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw error ?? new Error("Supabase did not return the created E2E user");
  }

  return { id: data.user.id, email, password };
}

export async function deleteE2EUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function seedApplicationsForE2EUser(userId: string, count: number): Promise<string> {
  const rows = Array.from({ length: count }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
    return {
      user_id: userId,
      title: `Seeded Engineer ${String(index + 1).padStart(3, "0")}`,
      company: `Seeded Company ${String(index + 1).padStart(3, "0")}`,
      applied_date: `2026-01-${day}`,
      location: "Remote",
      posting_url: `https://example.com/seeded-job/${index + 1}`,
      status: "applied",
      tech_stack: [],
      created_at: timestamp,
      updated_at: timestamp,
    };
  });

  const { data, error } = await supabaseAdmin.from("applications").insert(rows).select("id").limit(1);
  if (error || !data?.[0]?.id) {
    throw error ?? new Error("Supabase did not return the seeded application ID");
  }

  return data[0].id as string;
}
