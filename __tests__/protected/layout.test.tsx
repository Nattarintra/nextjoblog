import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { effectiveMock, cookiesMock, getUserMock } = vi.hoisted(() => ({
  effectiveMock: vi.fn(),
  cookiesMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getEffectiveSessionExpiry: effectiveMock,
  getSessionNoticeWindowMs: () => 1000,
}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/app/(protected)/_components/ProtectedAppShell", () => ({
  ProtectedAppShell: ({ email, children }: { email?: string; children: React.ReactNode }) => (
    <div>
      <div data-testid="chrome">{email ?? "no-email"}</div>
      {children}
    </div>
  ),
}));

import ProtectedLayout from "@/app/(protected)/layout";

async function renderLayout() {
  const ui = await ProtectedLayout({ children: <p>child</p> } as never);
  render(ui);
}

describe("ProtectedLayout", () => {
  beforeEach(() => {
    cleanup();
    effectiveMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: null } });
    cookiesMock.mockResolvedValue({ get: () => undefined });
  });

  it("passes the claims email to the chrome when authenticated", async () => {
    effectiveMock.mockResolvedValue({
      status: "authenticated",
      claims: { email: "ada@example.com", session_id: "session-id" },
      effectiveExpiresAt: Date.now() + 1000,
    });
    await renderLayout();
    expect(screen.getByTestId("chrome").textContent).toBe("ada@example.com");
    expect(screen.getByText("child")).toBeTruthy();
  });

  it("passes undefined when the claims carry no email", async () => {
    effectiveMock.mockResolvedValue({ status: "authenticated", claims: { session_id: "session-id" }, effectiveExpiresAt: 1 });
    await renderLayout();
    expect(screen.getByTestId("chrome").textContent).toBe("no-email");
  });

  it("falls back to the email in user metadata", async () => {
    effectiveMock.mockResolvedValue({
      status: "authenticated",
      claims: { user_metadata: { email: "ada@example.com" }, session_id: "session-id" },
      effectiveExpiresAt: Date.now() + 1000,
    });
    await renderLayout();
    expect(screen.getByTestId("chrome").textContent).toBe("ada@example.com");
  });

  it("falls back to the authenticated user when claims omit email", async () => {
    effectiveMock.mockResolvedValue({ status: "authenticated", claims: { session_id: "session-id" }, effectiveExpiresAt: Date.now() + 1000 });
    getUserMock.mockResolvedValue({ data: { user: { email: "ada@example.com" } } });
    await renderLayout();
    expect(screen.getByTestId("chrome").textContent).toBe("ada@example.com");
  });

  it("renders no top bar when unauthenticated", async () => {
    effectiveMock.mockResolvedValue({ status: "unauthenticated", reason: "missing" });
    await renderLayout();
    expect(screen.queryByTestId("chrome")).toBeNull();
    expect(screen.getByText("child")).toBeTruthy();
  });
});
