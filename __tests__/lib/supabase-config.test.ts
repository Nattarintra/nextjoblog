import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSupabaseAuthCookieStorageKey,
  getSupabaseConfig,
  SupabaseConfigError,
} from "@/lib/supabase/config";

describe("getSupabaseConfig", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the validated URL and anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(getSupabaseConfig()).toEqual({
      url: "https://project-ref.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("accepts a local http URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(getSupabaseConfig()).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "anon-key",
    });
  });

  it.each([undefined, ""])(
    "throws a missing_url failure when the URL is %s",
    (value) => {
      if (value !== undefined) {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", value);
      }
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

      expect(() => getSupabaseConfig()).toThrow(SupabaseConfigError);
      try {
        getSupabaseConfig();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(SupabaseConfigError);
        expect((error as SupabaseConfigError).reason).toBe("missing_url");
      }
    },
  );

  it.each(["not-a-url", "ftp://project-ref.supabase.co"])(
    "throws an invalid_url failure for %s",
    (invalidUrl) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", invalidUrl);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

      try {
        getSupabaseConfig();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(SupabaseConfigError);
        expect((error as SupabaseConfigError).reason).toBe("invalid_url");
      }
    },
  );

  it.each([undefined, ""])(
    "throws a missing_anon_key failure when the key is %s",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
      if (value !== undefined) {
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", value);
      }

      try {
        getSupabaseConfig();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(SupabaseConfigError);
        expect((error as SupabaseConfigError).reason).toBe("missing_anon_key");
      }
    },
  );

  it("never includes the anon key value in the thrown error", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "super-secret-anon-key");

    try {
      getSupabaseConfig();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(JSON.stringify(Object.getOwnPropertyNames(error))).not.toContain(
        "super-secret-anon-key",
      );
      expect((error as Error).message).not.toContain("super-secret-anon-key");
    }
  });

  it("re-reads process.env on every call rather than caching the result", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://first-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "first-key");
    expect(getSupabaseConfig().url).toBe("https://first-project.supabase.co");

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://second-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "second-key");
    expect(getSupabaseConfig()).toEqual({
      url: "https://second-project.supabase.co",
      anonKey: "second-key",
    });
  });
});

describe("getSupabaseAuthCookieStorageKey", () => {
  it("derives the key from the first hostname label, matching e2e/session-expiry.spec.ts", () => {
    expect(getSupabaseAuthCookieStorageKey("https://abcdefghijklmnop.supabase.co")).toBe(
      "sb-abcdefghijklmnop-auth-token",
    );
  });

  it("derives the local-stack key unchanged, matching today's module-load formula", () => {
    expect(getSupabaseAuthCookieStorageKey("http://127.0.0.1:54321")).toBe(
      "sb-127-auth-token",
    );
  });
});
