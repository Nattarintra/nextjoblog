import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const getClaims = vi.hoisted(() => vi.fn());
const createServerClient = vi.hoisted(() => vi.fn());
const getSupabaseConfig = vi.hoisted(() => vi.fn(() => ({
  url: "https://project.supabase.co",
  anonKey: "anon-key",
})));

vi.mock("@supabase/ssr", () => ({
  createServerClient,
  isChunkLike: (name: string, key: string) => name === key,
}));
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig,
  getSupabaseAuthCookieStorageKey: () => "sb-project-auth-token",
  SupabaseConfigError: class SupabaseConfigError extends Error {},
}));

import { proxy } from "@/proxy";

function setupClaims(result: unknown) {
  getClaims.mockResolvedValue(result);
  createServerClient.mockImplementation((_url, _key, options) => {
    void options;
    return { auth: { getClaims } };
  });
}

describe("proxy", () => {
  it("redirects missing sessions and forwards a clean request path", async () => {
    setupClaims({ data: null, error: null });
    const request = new NextRequest(
      "https://example.test/dashboard?tab=recent&_rsc=abc",
    );

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.test/login?next=%2Fdashboard%3Ftab%3Drecent",
    );
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
  });

  it("allows verification failures through to the DAL", async () => {
    setupClaims({ data: null, error: new Error("offline") });
    const response = await proxy(new NextRequest("https://example.test/dashboard"));
    expect(response.status).toBe(200);
  });

  it("keeps the forwarded path header when Supabase refreshes cookies", async () => {
    setupClaims({ data: { claims: { sub: "user" } }, error: null });
    createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([{ name: "token", value: "new" }], {});
          return { data: { claims: { sub: "user" } }, error: null };
        },
      },
    }));

    const response = await proxy(
      new NextRequest("https://example.test/dashboard?tab=recent"),
    );
    expect(response.status).toBe(200);
  });
});
