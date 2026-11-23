import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navState, logoutState, noticeState } = vi.hoisted(() => ({
  navState: { pathname: "/dashboard" },
  logoutState: { logout: vi.fn(), errorMessage: null as string | null, isPending: false },
  noticeState: { show: false, notify: null as ((show: boolean) => void) | null, extended: null as ((expiry: number, cycleToken: string) => void) | null },
}));

vi.mock("next/navigation", () => ({ usePathname: () => navState.pathname }));
vi.mock("@/app/(protected)/_components/useLogout", () => ({ useLogout: () => logoutState }));
vi.mock("@/app/(protected)/_components/SessionExpiryNotice", () => ({
  SessionExpiryNotice: ({ onShowChange, onExtended }: { onShowChange: (show: boolean) => void; onExtended: (expiry: number, cycleToken: string) => void }) => {
    noticeState.notify = onShowChange;
    noticeState.extended = onExtended;
    return null;
  },
}));

import { ProtectedAppShell } from "@/app/(protected)/_components/ProtectedAppShell";

function renderShell() {
  return render(
    <ProtectedAppShell email="ada@example.com" sessionExpiresAt={1} noticeWindowMs={1} passwordUpdated={false}>
      <p>page body</p>
    </ProtectedAppShell>,
  );
}

const menuButton = () => screen.getByRole("button", { name: "Open menu" });

describe("ProtectedAppShell navigation", () => {
  beforeEach(() => {
    cleanup();
    navState.pathname = "/dashboard";
    document.body.style.overflow = "";
  });

  it("renders the page body and no drawer until the menu is opened", () => {
    renderShell();
    expect(screen.getByText("page body")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    // Only the static side nav landmark exists while the drawer is closed.
    expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(1);
  });

  it("opens the drawer as a modal dialog with its own Main landmark, focus on Close, and locks scroll", () => {
    renderShell();
    fireEvent.click(menuButton());
    const drawer = screen.getByRole("dialog", { name: "Main menu" });
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close menu" }));
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(2);
  });

  it("closes on Escape, returns focus to the menu button and unlocks scroll", () => {
    renderShell();
    fireEvent.click(menuButton());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(menuButton());
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on the Close button and on a backdrop click, but not on a click inside", () => {
    renderShell();
    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when a drawer link is chosen, even if the path does not change", () => {
    renderShell();
    fireEvent.click(menuButton());
    const dashboardLinks = screen.getAllByRole("link", { name: "Dashboard" });
    fireEvent.click(dashboardLinks[dashboardLinks.length - 1]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when the route changes", () => {
    const { rerender } = renderShell();
    fireEvent.click(menuButton());
    navState.pathname = "/applications";
    rerender(
      <ProtectedAppShell email="ada@example.com" sessionExpiresAt={1} noticeWindowMs={1} passwordUpdated={false}>
        <p>page body</p>
      </ProtectedAppShell>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("traps Tab inside the drawer in both directions", () => {
    renderShell();
    fireEvent.click(menuButton());
    const drawer = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close menu" });
    const account = screen.getAllByRole("button", { name: /Account/ }).find((button) => drawer.contains(button)) as HTMLElement;

    act(() => account.focus());
    fireEvent.keyDown(drawer, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(account);
  });

  it("hands over from the drawer to the account dialog so two modals never coexist", () => {
    renderShell();
    fireEvent.click(menuButton());
    const drawer = screen.getByRole("dialog", { name: "Main menu" });
    const account = screen.getAllByRole("button", { name: /Account/ }).find((button) => drawer.contains(button)) as HTMLElement;
    fireEvent.click(account);
    expect(screen.queryByRole("dialog", { name: "Main menu" })).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Account" })).toBeTruthy();
  });

  it("keeps page scroll locked through the drawer-to-account handover and releases it on close", () => {
    const { container } = renderShell();
    const scroller = container.querySelector("p")?.parentElement as HTMLElement;
    expect(scroller.className).toContain("overflow-y-auto");

    fireEvent.click(menuButton());
    const drawer = screen.getByRole("dialog", { name: "Main menu" });
    const account = screen.getAllByRole("button", { name: /Account/ }).find((button) => drawer.contains(button)) as HTMLElement;
    fireEvent.click(account);
    expect(screen.getByRole("dialog", { name: "Account" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    expect(scroller.className).toContain("overflow-hidden");

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Account" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(scroller.className).toContain("overflow-y-auto");
  });

  it("logs out through the single shared control from the header account dialog", () => {
    renderShell();
    const headerAccount = screen.getAllByRole("button", { name: "Account" })[0];
    fireEvent.click(headerAccount);
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    expect(logoutState.logout).toHaveBeenCalledTimes(1);
  });

  it("closes the drawer when the session-expiry notice takes over", () => {
    renderShell();
    fireEvent.click(menuButton());
    act(() => noticeState.notify?.(true));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(menuButton());
  });

  it("renders the shell toast only from the confirmed server expiry", () => {
    renderShell();
    act(() => noticeState.extended?.(Date.UTC(2030, 0, 2, 12, 30), "next-cycle-token"));
    expect(screen.getByRole("status").textContent).toContain("Jan 2, 2030");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss login extension message" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
