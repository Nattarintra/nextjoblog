import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.redirect(new URL("/login", request.url));
}
