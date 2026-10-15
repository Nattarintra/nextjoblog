import { AuthApiError } from "@supabase/auth-js";
import { describe, expect, it, vi } from "vitest";

import { LOGOUT_LOG_EVENT, LOGOUT_MESSAGES } from "@/app/actions/logout-messages";
import { createLogout } from "@/lib/auth/logout";
import { SupabaseConfigError } from "@/lib/supabase/config";

const claims = { data: { claims: { sub: "user", email: "a@b.co" } }, error: null };

function setup(
  auth: { signOut: () => Promise<{ error: unknown }>; getClaims?: () => Promise<unknown> },
  extra: { forcedOutcome?: () => Promise<"fail" | "unconfirmed" | undefined> } = {},
) {
  const log = vi.fn();
  const createClient = vi.fn(async () => ({
    auth: { getClaims: async () => claims, ...auth } as never,
  }));
  return { logout: createLogout({ createClient, log, ...extra }), log, createClient };
}

describe("createLogout", () => {
  it("returns ok on success without logging", async () => {
    const { logout, log } = setup({ signOut: async () => ({ error: null }) });

    await expect(logout(undefined)).resolves.toEqual({ ok: true });
    expect(log).not.toHaveBeenCalled();
  });

  it("returns still_signed_in and logs only code and status", async () => {
    const { logout, log } = setup({
      signOut: async () => ({ error: new AuthApiError("secret a@b.co", 500, "unexpected_failure") }),
    });

    await expect(logout(undefined)).resolves.toEqual({
      error: "still_signed_in",
      message: LOGOUT_MESSAGES.stillSignedIn,
    });
    expect(log).toHaveBeenCalledWith(LOGOUT_LOG_EVENT.providerError, {
      code: "unexpected_failure",
      status: 500,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("a@b.co");
  });

  it("returns unconfirmed when verification fails", async () => {
    const { logout, log } = setup({
      signOut: async () => ({ error: new Error("net") }),
      getClaims: async () => ({ data: null, error: new Error("net") }),
    });

    const state = await logout(undefined);

    expect(state).toEqual({ error: "unconfirmed", message: LOGOUT_MESSAGES.unconfirmed });
    expect(state && "message" in state && state.message).not.toMatch(/still logged in/i);
    expect(log).toHaveBeenCalledWith(LOGOUT_LOG_EVENT.unconfirmed, {
      code: undefined,
      status: undefined,
    });
  });

  it("maps SupabaseConfigError to configuration", async () => {
    const log = vi.fn();
    const logout = createLogout({
      createClient: async () => {
        throw new SupabaseConfigError("missing_url");
      },
      log,
    });

    await expect(logout(undefined)).resolves.toMatchObject({ error: "configuration" });
    expect(log).toHaveBeenCalledWith(LOGOUT_LOG_EVENT.configuration, { code: "missing_url" });
  });

  it("maps unexpected throws to unknown without leaking the error", async () => {
    const log = vi.fn();
    const logout = createLogout({
      createClient: async () => {
        throw new Error("secret");
      },
      log,
    });

    await expect(logout(undefined)).resolves.toMatchObject({ error: "unknown" });
    expect(log).toHaveBeenCalledWith(LOGOUT_LOG_EVENT.unexpected);
  });

  it("honours a forced outcome without touching Supabase", async () => {
    const forced = setup(
      { signOut: async () => ({ error: null }) },
      { forcedOutcome: async () => "fail" },
    );
    await expect(forced.logout(undefined)).resolves.toMatchObject({ error: "still_signed_in" });
    expect(forced.createClient).not.toHaveBeenCalled();

    const unconfirmed = setup(
      { signOut: async () => ({ error: null }) },
      { forcedOutcome: async () => "unconfirmed" },
    );
    await expect(unconfirmed.logout(undefined)).resolves.toMatchObject({ error: "unconfirmed" });
  });

  it("proceeds normally when no outcome is forced", async () => {
    const { logout } = setup(
      { signOut: async () => ({ error: null }) },
      { forcedOutcome: async () => undefined },
    );
    await expect(logout(undefined)).resolves.toEqual({ ok: true });
  });
});
