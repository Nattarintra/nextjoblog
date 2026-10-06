import { describe, expect, it, vi } from "vitest";

const { getEffectiveSessionExpiryMock, cookiesMock, headersMock, redirectMock } = vi.hoisted(() => ({
  getEffectiveSessionExpiryMock: vi.fn(),
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn((url: string): never => { throw new Error(`redirect:${url}`); }),
}));

vi.mock("@/lib/session", () => ({
  getEffectiveSessionExpiry: getEffectiveSessionExpiryMock,
  isSessionExpired: (expiresAt: number, now: number) => now >= expiresAt,
}));
vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { requireSession } from "@/lib/auth/require-session";

describe("requireSession default dependencies", () => {
  it("reads the request path and test cookie through the framework adapters", async () => {
    getEffectiveSessionExpiryMock.mockResolvedValue({
      status: "authenticated",
      claims: { sub: "user", session_id: "session" },
      effectiveExpiresAt: Date.now() + 10_000,
    });
    headersMock.mockResolvedValue({ get: () => "/dashboard" });
    cookiesMock.mockResolvedValue({ get: () => undefined });

    await expect(requireSession()).resolves.toMatchObject({ status: "authenticated" });
  });
});
