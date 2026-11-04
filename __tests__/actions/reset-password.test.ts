import { AuthApiError } from "@supabase/auth-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createStatelessSupabaseClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  logAuthEvent: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/stateless", () => ({
  createStatelessSupabaseClient: mocks.createStatelessSupabaseClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("@/lib/auth/log", () => ({ logAuthEvent: mocks.logAuthEvent }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, RedirectType: { replace: "replace" } }));

import { resetPasswordAction } from "@/app/actions/reset-password";

const tokens = {
  access_token: "access-token",
  refresh_token: "refresh-token",
};

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function validForm(overrides: Record<string, string> = {}): FormData {
  return formData({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    password: "new-password",
    confirmation: "new-password",
    ...overrides,
  });
}

describe("resetPasswordAction", () => {
  const setSession = vi.fn();
  const updateUser = vi.fn();
  const getSession = vi.fn();
  const cookieSetSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ set: vi.fn() });
    mocks.createStatelessSupabaseClient.mockReturnValue({
      auth: { setSession, updateUser, getSession },
    });
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { setSession: cookieSetSession },
    });
    setSession.mockResolvedValue({
      data: { session: { ...tokens } },
      error: null,
    });
    updateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "latest-access-token",
          refresh_token: "latest-refresh-token",
        },
      },
    });
    cookieSetSession.mockResolvedValue({ error: null });
  });

  it("updates the password before starting the cookie session with latest tokens", async () => {
    await expect(resetPasswordAction(undefined, validForm())).resolves.toEqual({
      status: "updated",
    });

    expect(setSession).toHaveBeenCalledWith(tokens);
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(getSession).toHaveBeenCalledOnce();
    expect(mocks.createServerSupabaseClient).toHaveBeenCalledOnce();
    expect(cookieSetSession).toHaveBeenCalledWith({
      access_token: "latest-access-token",
      refresh_token: "latest-refresh-token",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard", "replace");
    expect(mocks.cookies).toHaveBeenCalledOnce();
  });

  it("does not call Supabase or create cookies for invalid password input", async () => {
    await expect(
      resetPasswordAction(undefined, validForm({ password: "short", confirmation: "short" })),
    ).resolves.toEqual({ status: "too_short" });

    expect(mocks.createStatelessSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns the provider error state without starting a cookie session", async () => {
    const error = new AuthApiError("expired", 400, "otp_expired");
    setSession.mockResolvedValue({ data: { session: null }, error });

    await expect(resetPasswordAction(undefined, validForm())).resolves.toEqual({
      status: "expired",
    });

    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      "auth.password_reset_confirm.provider_error",
      { code: "otp_expired", status: 400 },
    );
  });

  it("does not expose secrets in provider log details", async () => {
    const error = new AuthApiError("failed", 422, "same_password");
    updateUser.mockResolvedValue({ data: { user: null }, error });

    await resetPasswordAction(undefined, validForm());

    expect(JSON.stringify(mocks.logAuthEvent.mock.calls)).not.toContain("new-password");
    expect(JSON.stringify(mocks.logAuthEvent.mock.calls)).not.toContain("access-token");
    expect(cookieSetSession).not.toHaveBeenCalled();
  });

  it("falls back to the verified recovery session when no rotated session is available", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(resetPasswordAction(undefined, validForm())).resolves.toEqual({
      status: "updated",
    });

    expect(cookieSetSession).toHaveBeenCalledWith(tokens);
  });

  it("maps an unexpected action dependency failure to an opaque error", async () => {
    mocks.createStatelessSupabaseClient.mockImplementation(() => {
      throw new Error("configuration details must stay private");
    });

    await expect(resetPasswordAction(undefined, validForm())).resolves.toEqual({
      status: "unknown",
    });

    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      "auth.password_reset_confirm.unexpected_error",
      {},
    );
  });
});
