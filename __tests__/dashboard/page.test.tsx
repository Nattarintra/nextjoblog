import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock } = vi.hoisted(() => ({ requireSessionMock: vi.fn() }));
vi.mock("@/lib/auth/require-session", () => ({ requireSession: requireSessionMock }));

import DashboardPage from "@/app/(protected)/dashboard/page";

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the dashboard for an authenticated session", async () => {
    requireSessionMock.mockResolvedValue({ status: "authenticated", claims: { sub: "user" }, effectiveExpiresAt: Date.now() + 10_000 });
    expect((await DashboardPage()).props.children.props.children).toBe("Dashboard");
  });

  it("renders the session failure screen without dashboard content", async () => {
    requireSessionMock.mockResolvedValue({ status: "verification_failed", loginHref: "/login?next=%2Fdashboard" });
    const result = await DashboardPage();
    expect(result.type.name).toBe("SessionCheckFailed");
    expect(result.props.loginHref).toBe("/login?next=%2Fdashboard");
  });

  it("delegates authentication redirects to requireSession", async () => {
    const redirectError = new Error("redirect");
    requireSessionMock.mockRejectedValue(redirectError);
    await expect(DashboardPage()).rejects.toBe(redirectError);
  });
});
