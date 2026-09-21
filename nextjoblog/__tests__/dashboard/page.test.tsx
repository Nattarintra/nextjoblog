import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEffectiveSessionExpiryMock, isSessionExpiredMock, redirectMock } = vi.hoisted(() => ({
  getEffectiveSessionExpiryMock: vi.fn(),
  isSessionExpiredMock: vi.fn(() => false),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getEffectiveSessionExpiry: getEffectiveSessionExpiryMock,
  isSessionExpired: isSessionExpiredMock,
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import DashboardPage from "@/app/dashboard/page";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSessionExpiredMock.mockReturnValue(false);
  });

  it("does not sign out when the session extension lookup fails", async () => {
    const lookupError = new Error("database unavailable");
    getEffectiveSessionExpiryMock.mockResolvedValue({
      status: "lookup_error",
      error: lookupError,
    });

    await expect(DashboardPage()).rejects.toBe(lookupError);

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects expired sessions to the response-context logout handler", async () => {
    getEffectiveSessionExpiryMock.mockResolvedValue({
      status: "authenticated",
      claims: {},
      effectiveExpiresAt: 1,
    });
    isSessionExpiredMock.mockReturnValue(true);

    await DashboardPage();

    expect(redirectMock).toHaveBeenCalledWith("/api/auth/session-expired");
  });
});
