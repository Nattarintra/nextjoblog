import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  after: vi.fn(),
  createClient: vi.fn(),
  getSupabaseConfig: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.getSupabaseConfig }));
vi.mock("@/lib/auth/request-password-reset", () => ({ requestPasswordReset: mocks.requestPasswordReset }));

import { requestPasswordResetAction } from "@/app/actions/password-reset";

function formData(email: string): FormData {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PASSWORD_RESET_ENABLED = "1";
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000";
    process.env.RATE_LIMIT_HASH_SECRET = "s".repeat(32);
    mocks.headers.mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "203.0.113.5" }));
    mocks.getSupabaseConfig.mockReturnValue({ url: "http://127.0.0.1:54321", anonKey: "anon" });
    mocks.createClient.mockReturnValue({ rpc: vi.fn() });
    mocks.requestPasswordReset.mockResolvedValue({ status: "sent" });
    mocks.after.mockImplementation((callback: () => Promise<void>) => callback());
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns the only visible validation error without reading dependencies", async () => {
    await expect(requestPasswordResetAction(undefined, formData("not-an-email"))).resolves.toEqual({
      error: "invalid_email",
    });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns the neutral state when the release flag is off", async () => {
    process.env.PASSWORD_RESET_ENABLED = "0";

    await expect(requestPasswordResetAction(undefined, formData("USER@example.com"))).resolves.toEqual({
      status: "sent",
      email: "user@example.com",
    });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("maps the use-case states and passes the normalized request", async () => {
    mocks.requestPasswordReset.mockResolvedValue({ status: "rate_limited", retryAfterSeconds: 30 });

    await expect(requestPasswordResetAction(undefined, formData(" USER@example.com "))).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 30,
    });
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, hashSecret: "s".repeat(32) }),
      { email: "user@example.com", clientIp: "203.0.113.5" },
    );
  });

  it("collapses configuration failures to the neutral state", async () => {
    mocks.getSupabaseConfig.mockImplementation(() => {
      throw new Error("configuration failure");
    });

    await expect(requestPasswordResetAction(undefined, formData("user@example.com"))).resolves.toEqual({
      status: "sent",
      email: "user@example.com",
    });
  });

  it.each([
    [undefined, "missing_site_url"],
    ["ftp://example.com", "invalid_site_url"],
  ])("returns neutral state without scheduling when site URL is %s", async (siteUrl, code) => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    if (siteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
    }

    await expect(requestPasswordResetAction(undefined, formData("user@example.com"))).resolves.toEqual({
      status: "sent",
      email: "user@example.com",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "auth.password_reset.configuration_error",
      { code },
    );
  });
});
