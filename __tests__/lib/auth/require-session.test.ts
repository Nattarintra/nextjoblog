import { describe, expect, it, vi } from "vitest";

import { createRequireSession } from "@/lib/auth/require-session";

const authenticated = {
  status: "authenticated" as const,
  claims: { session_id: "session", sub: "user" },
  effectiveExpiresAt: 2_000,
};

function setup(state: typeof authenticated | { status: "unauthenticated"; reason: "missing" } | { status: "verification_failed"; error: Error }, path = "/dashboard") {
  const redirect = vi.fn((url: string): never => { throw new Error(`redirect:${url}`); });
  return {
    require: createRequireSession({
      getSessionState: vi.fn().mockResolvedValue(state),
      getRequestPath: vi.fn().mockResolvedValue(path),
      redirect,
      now: () => 1_000,
    }),
    redirect,
  };
}

describe("createRequireSession", () => {
  it("returns an unexpired authenticated session", async () => {
    await expect(setup(authenticated).require()).resolves.toEqual(authenticated);
  });

  it("redirects unauthenticated users", async () => {
    await expect(setup({ status: "unauthenticated", reason: "missing" }).require()).rejects.toThrow(
      "redirect:/login?next=%2Fdashboard",
    );
  });

  it("redirects expired sessions to the session-expired handler", async () => {
    const result = setup({ ...authenticated, effectiveExpiresAt: 500 });
    await expect(result.require()).rejects.toThrow(
      "redirect:/api/auth/session-expired?next=%2Fdashboard",
    );
  });

  it("returns a login href without redirecting on verification failure", async () => {
    await expect(
      setup({ status: "verification_failed", error: new Error("offline") }).require(),
    ).resolves.toEqual({
      status: "verification_failed",
      loginHref: "/login?next=%2Fdashboard",
    });
  });

  it("falls back to the dashboard when the request path is missing", async () => {
    const redirect = vi.fn((url: string): never => { throw new Error(`redirect:${url}`); });
    const require = createRequireSession({
      getSessionState: vi.fn().mockResolvedValue({ status: "unauthenticated", reason: "missing" }),
      getRequestPath: vi.fn().mockResolvedValue(undefined),
      redirect,
    });

    await expect(require()).rejects.toThrow("redirect:/login");
  });
});
