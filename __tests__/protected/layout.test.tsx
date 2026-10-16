import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { effectiveMock } = vi.hoisted(() => ({ effectiveMock: vi.fn() }));

vi.mock("@/lib/session", () => ({
  getEffectiveSessionExpiry: effectiveMock,
  getSessionNoticeWindowMs: () => 1000,
}));
vi.mock("@/app/(protected)/_components/ProtectedAppShell", () => ({
  ProtectedAppShell: ({ email }: { email?: string }) => <div data-testid="chrome">{email ?? "no-email"}</div>,
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
  });

  it("passes the claims email to the chrome when authenticated", async () => {
    effectiveMock.mockResolvedValue({
      status: "authenticated",
      claims: { email: "ada@example.com" },
      effectiveExpiresAt: Date.now() + 1000,
    });
    await renderLayout();
    expect(screen.getByTestId("chrome").textContent).toBe("ada@example.com");
    expect(screen.getByText("child")).toBeTruthy();
  });

  it("passes undefined when the claims carry no email", async () => {
    effectiveMock.mockResolvedValue({ status: "authenticated", claims: {}, effectiveExpiresAt: 1 });
    await renderLayout();
    expect(screen.getByTestId("chrome").textContent).toBe("no-email");
  });

  it("renders no top bar when unauthenticated", async () => {
    effectiveMock.mockResolvedValue({ status: "unauthenticated", reason: "missing" });
    await renderLayout();
    expect(screen.queryByTestId("chrome")).toBeNull();
    expect(screen.getByText("child")).toBeTruthy();
  });
});
