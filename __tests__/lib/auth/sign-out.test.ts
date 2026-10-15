import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/auth-js";
import { describe, expect, it, vi } from "vitest";

import { signOutCurrentSession } from "@/lib/auth/sign-out";

const claims = { data: { claims: { sub: "user" } }, error: null };

function setup(options: {
  signOut?: () => Promise<{ error: unknown }>;
  getClaims?: () => Promise<unknown>;
}) {
  const signOut = vi.fn(options.signOut ?? (async () => ({ error: null })));
  const getClaims = vi.fn(options.getClaims ?? (async () => claims));
  const auth = { signOut, getClaims } as unknown as Parameters<typeof signOutCurrentSession>[0];
  return { auth, signOut, getClaims };
}

describe("signOutCurrentSession", () => {
  it("signs out once with local scope and skips the re-check on success", async () => {
    const { auth, signOut, getClaims } = setup({});

    await expect(signOutCurrentSession(auth)).resolves.toEqual({ kind: "signed_out" });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("treats an error followed by no session as signed out", async () => {
    const { auth } = setup({
      signOut: async () => ({ error: new AuthRetryableFetchError("network", 0) }),
      getClaims: async () => ({ data: null, error: new AuthSessionMissingError() }),
    });

    await expect(signOutCurrentSession(auth)).resolves.toEqual({ kind: "signed_out" });
  });

  it("reports still_signed_in with code and status when the session survives", async () => {
    const { auth } = setup({
      signOut: async () => ({ error: new AuthApiError("boom", 500, "unexpected_failure") }),
    });

    await expect(signOutCurrentSession(auth)).resolves.toEqual({
      kind: "still_signed_in",
      code: "unexpected_failure",
      status: 500,
    });
  });

  it("reports unconfirmed when the re-check cannot verify", async () => {
    const { auth } = setup({
      signOut: async () => ({ error: new AuthRetryableFetchError("network", 0) }),
      getClaims: async () => ({ data: null, error: new AuthRetryableFetchError("network", 0) }),
    });

    await expect(signOutCurrentSession(auth)).resolves.toEqual({
      kind: "unconfirmed",
      status: 0,
    });
  });

  it("re-checks after a thrown signOut", async () => {
    const { auth, getClaims } = setup({
      signOut: async () => {
        throw new Error("boom");
      },
    });

    await expect(signOutCurrentSession(auth)).resolves.toEqual({ kind: "still_signed_in" });
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("reports unconfirmed when both signOut and the re-check throw", async () => {
    const { auth } = setup({
      signOut: async () => {
        throw "nope";
      },
      getClaims: async () => {
        throw new Error("down");
      },
    });

    await expect(signOutCurrentSession(auth)).resolves.toEqual({ kind: "unconfirmed" });
  });
});
