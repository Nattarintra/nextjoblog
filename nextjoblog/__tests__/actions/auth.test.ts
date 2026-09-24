import { AuthApiError } from "@supabase/auth-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClientMock, redirectMock, signUpMock, signInWithPasswordMock } =
  vi.hoisted(() => ({
    createServerSupabaseClientMock: vi.fn(),
    redirectMock: vi.fn(),
    signUpMock: vi.fn(),
    signInWithPasswordMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { SupabaseConfigError } from "@/lib/supabase/config";

import { login, signup } from "@/app/actions/auth";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

const VALID_EMAIL = "new@example.com";
const VALID_PASSWORD = "correct-password";

describe("signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createServerSupabaseClientMock.mockResolvedValue({
      auth: { signUp: signUpMock, signInWithPassword: signInWithPasswordMock },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects to /dashboard when signup returns a user and a session", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "token" } },
      error: null,
    });

    await expect(
      signup(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("returns confirmation_required when signup returns a user but no session", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    const result = await signup(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    expect(result).toEqual({ status: "confirmation_required" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns duplicate_email for an already-registered address", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("User already registered", 400, "user_already_exists"),
    });

    const result = await signup(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    expect(result).toEqual({ error: "duplicate_email" });
  });

  it("returns weak_password without calling the provider for a short password", async () => {
    const result = await signup(undefined, formData({ email: VALID_EMAIL, password: "abc" }));

    expect(result).toEqual({ error: "weak_password" });
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("returns unknown for an invalid email shape without calling the provider", async () => {
    const result = await signup(undefined, formData({ email: "not-an-email", password: VALID_PASSWORD }));

    expect(result).toEqual({
      error: "unknown",
      message: "Please enter a valid email address.",
    });
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("returns configuration on invalid Supabase configuration without leaking the reason", async () => {
    createServerSupabaseClientMock.mockRejectedValue(new SupabaseConfigError("missing_url"));

    const result = await signup(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    expect(result).toEqual({ error: "configuration" });
  });

  it("returns unknown for an unexpected provider failure", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("Something broke", 500, "unexpected_failure"),
    });

    const result = await signup(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    expect(result).toEqual({
      error: "unknown",
      message: "Unable to create account. Please try again.",
    });
  });

  it("never logs the password, email, or config error message", async () => {
    createServerSupabaseClientMock.mockRejectedValue(new SupabaseConfigError("missing_anon_key"));
    const consoleErrorSpy = vi.spyOn(console, "error");

    await signup(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    for (const call of consoleErrorSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(VALID_PASSWORD);
      expect(serialized).not.toContain(VALID_EMAIL);
      expect(serialized).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
    }
  });

  it("does not swallow the redirect when it is thrown for successful signup", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "token" } },
      error: null,
    });

    await expect(
      signup(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD })),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    createServerSupabaseClientMock.mockResolvedValue({
      auth: { signUp: signUpMock, signInWithPassword: signInWithPasswordMock },
    });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects to /dashboard on successful login", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: null });

    await expect(
      login(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("returns invalid_credentials for a wrong password", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {},
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });

    const result = await login(undefined, formData({ email: VALID_EMAIL, password: "wrong" }));

    expect(result).toEqual({ error: "invalid_credentials" });
  });

  it("returns confirmation_required for an unconfirmed account", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {},
      error: new AuthApiError("Email not confirmed", 400, "email_not_confirmed"),
    });

    const result = await login(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    expect(result).toEqual({ status: "confirmation_required" });
  });

  it("returns configuration on invalid Supabase configuration", async () => {
    createServerSupabaseClientMock.mockRejectedValue(new SupabaseConfigError("invalid_url"));

    const result = await login(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    expect(result).toEqual({ error: "configuration" });
  });

  it("returns unknown for an unexpected provider failure", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {},
      error: new AuthApiError("Something broke", 500, "unexpected_failure"),
    });

    const result = await login(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD }));

    expect(result).toEqual({
      error: "unknown",
      message: "Unable to log in. Please try again.",
    });
  });

  it("returns unknown for an invalid email shape without calling the provider", async () => {
    const result = await login(undefined, formData({ email: "not-an-email", password: VALID_PASSWORD }));

    expect(result).toEqual({
      error: "unknown",
      message: "Please enter a valid email address.",
    });
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("does not swallow the redirect when it is thrown for successful login", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: null });

    await expect(
      login(undefined, formData({ email: VALID_EMAIL, password: VALID_PASSWORD })),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
