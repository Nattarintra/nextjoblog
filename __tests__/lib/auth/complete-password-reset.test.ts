import {
  AuthApiError,
  AuthSessionMissingError,
} from "@supabase/auth-js";
import { describe, expect, it, vi } from "vitest";

import {
  classifyRecoveryError,
  completePasswordReset,
} from "@/lib/auth/complete-password-reset";

const input = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  password: "new-password",
  confirmation: "new-password",
};

function providerError(code: string, status = 400): AuthApiError {
  return new AuthApiError("provider failure", status, code);
}

describe("classifyRecoveryError", () => {
  it.each([
    [providerError("weak_password", 422), "too_short"],
    [providerError("same_password", 422), "same_password"],
    [providerError("otp_expired"), "expired"],
    [providerError("session_expired"), "expired"],
    [providerError("session_not_found"), "expired"],
    [providerError("refresh_token_not_found"), "expired"],
    [providerError("refresh_token_already_used"), "expired"],
    [providerError("bad_jwt"), "expired"],
    [providerError("invalid_jwt"), "expired"],
    [new AuthSessionMissingError(), "expired"],
    [providerError("server_down", 503), "network"],
    [providerError("offline", 0), "network"],
    [new TypeError("fetch failed"), "network"],
    [new Error("unexpected"), "unknown"],
  ] as const)("maps provider error to %s", (error, expected) => {
    expect(classifyRecoveryError(error)).toBe(expected);
  });
});

describe("completePasswordReset", () => {
  it("does not call the provider for a short password or mismatch", async () => {
    const auth = { setSession: vi.fn(), updateUser: vi.fn() };
    const session = { start: vi.fn() };

    await expect(
      completePasswordReset({ auth, session }, { ...input, password: "short", confirmation: "short" }),
    ).resolves.toEqual({ status: "too_short" });
    await expect(
      completePasswordReset({ auth, session }, { ...input, confirmation: "different" }),
    ).resolves.toEqual({ status: "mismatch" });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(session.start).not.toHaveBeenCalled();
  });

  it.each([
    [providerError("otp_expired"), "expired"],
    [providerError("same_password"), "same_password"],
    [providerError("weak_password", 422), "too_short"],
    [providerError("server_down", 503), "network"],
  ] as const)("does not start a session after %s fails", async (error, status) => {
    const auth = {
      setSession: vi.fn().mockResolvedValue({ session: { ...input }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ session: null, error }),
    };
    const session = { start: vi.fn() };

    await expect(completePasswordReset({ auth, session }, input)).resolves.toEqual({ status });
    expect(session.start).not.toHaveBeenCalled();
  });

  it("starts the cookie session with the newest provider tokens", async () => {
    const rotatedTokens = {
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
    };
    const latestTokens = {
      accessToken: "latest-access-token",
      refreshToken: "latest-refresh-token",
    };
    const auth = {
      setSession: vi.fn().mockResolvedValue({ session: rotatedTokens, error: null }),
      updateUser: vi.fn().mockResolvedValue({ session: latestTokens, error: null }),
    };
    const session = { start: vi.fn() };

    await expect(completePasswordReset({ auth, session }, input)).resolves.toEqual({ status: "updated" });
    expect(session.start).toHaveBeenCalledOnce();
    expect(session.start).toHaveBeenCalledWith(latestTokens);
  });

  it("maps a missing session returned by the provider to expired", async () => {
    const auth = {
      setSession: vi.fn().mockResolvedValue({ session: null, error: null }),
      updateUser: vi.fn(),
    };
    const session = { start: vi.fn() };

    await expect(completePasswordReset({ auth, session }, input)).resolves.toEqual({ status: "expired" });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(session.start).not.toHaveBeenCalled();
  });

  it("returns login_required when the cookie session cannot be started after the update", async () => {
    const auth = {
      setSession: vi.fn().mockResolvedValue({ session: { ...input }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ session: { ...input }, error: null }),
    };
    const session = { start: vi.fn().mockRejectedValue(new Error("cookie write failed")) };

    await expect(completePasswordReset({ auth, session }, input)).resolves.toEqual({
      status: "login_required",
    });
  });
});
