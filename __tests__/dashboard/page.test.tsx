import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEffectiveSessionExpiryMock, signOutMock } = vi.hoisted(() => ({
  getEffectiveSessionExpiryMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getEffectiveSessionExpiry: getEffectiveSessionExpiryMock,
  isSessionExpired: vi.fn(() => false),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { signOut: signOutMock },
  })),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import DashboardPage from "@/app/dashboard/page";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not sign out when the session extension lookup fails", async () => {
    const lookupError = new Error("database unavailable");
    getEffectiveSessionExpiryMock.mockResolvedValue({
      status: "lookup_error",
      error: lookupError,
    });

    await expect(DashboardPage()).rejects.toBe(lookupError);

    expect(signOutMock).not.toHaveBeenCalled();
  });
});
