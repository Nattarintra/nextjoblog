import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClientMock, cookiesMock, signOutMock, getClaimsMock } = vi.hoisted(
  () => ({
    createServerSupabaseClientMock: vi.fn(),
    cookiesMock: vi.fn(),
    signOutMock: vi.fn(),
    getClaimsMock: vi.fn(),
  }),
);

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));
vi.mock("@/lib/auth/log", () => ({ logAuthEvent: vi.fn() }));

import { POST } from "@/app/api/auth/logout/route";
import { LOGOUT_MESSAGES } from "@/app/actions/logout-messages";

function setCookie(value: string | undefined): void {
  cookiesMock.mockResolvedValue({ get: () => (value === undefined ? undefined : { value }) });
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    setCookie(undefined);
    signOutMock.mockResolvedValue({ error: null });
    createServerSupabaseClientMock.mockResolvedValue({
      auth: { signOut: signOutMock, getClaims: getClaimsMock },
    });
  });

  it("signs out the current session only and returns ok with no-store", async () => {
    const response = await POST();

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
  });

  it("honours the e2e failure cookie when hooks are enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_TEST_HOOKS", "1");
    setCookie("fail");

    await expect((await POST()).json()).resolves.toEqual({
      error: "still_signed_in",
      message: LOGOUT_MESSAGES.stillSignedIn,
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("maps the unconfirmed cookie to the generic error", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_TEST_HOOKS", "1");
    setCookie("unconfirmed");

    await expect((await POST()).json()).resolves.toMatchObject({ error: "unconfirmed" });
  });

  it("ignores the failure cookie when hooks are disabled", async () => {
    vi.stubEnv("E2E_TEST_HOOKS", "0");
    setCookie("fail");

    await expect((await POST()).json()).resolves.toEqual({ ok: true });
  });
});
