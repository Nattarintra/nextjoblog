import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/applications" }));

import { SideNav } from "@/app/(protected)/_components/SideNav";

const logoutState = { logout: vi.fn(), errorMessage: null as string | null, isPending: false };

function renderSideNav(props: Partial<React.ComponentProps<typeof SideNav>> = {}) {
  return render(<SideNav email="ada@example.com" logoutControl={logoutState} {...props} />);
}

describe("SideNav (identity and logout, formerly AccountControls)", () => {
  beforeEach(() => {
    cleanup();
    logoutState.logout = vi.fn();
    logoutState.errorMessage = null;
    logoutState.isPending = false;
  });

  it("renders the account identity and wires Log Out to the shared hook via the dialog", () => {
    renderSideNav();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Account/ }));
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    expect(logoutState.logout).toHaveBeenCalledTimes(1);
  });

  it("shows pending and error states in the dialog", () => {
    logoutState.errorMessage = "still in";
    const { rerender } = renderSideNav();
    fireEvent.click(screen.getByRole("button", { name: /Account/ }));
    expect(screen.getByRole("alert").textContent).toContain("still in");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();

    logoutState.isPending = true;
    rerender(<SideNav email="ada@example.com" logoutControl={{ ...logoutState }} />);
    expect((screen.getByRole("button", { name: "Logging out…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the same logout control when the dialog is opened and closed", () => {
    renderSideNav();
    fireEvent.click(screen.getByRole("button", { name: /Account/ }));
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(logoutState.logout).toHaveBeenCalledTimes(1);
  });

  it("renders one Main landmark with the current page marked and an Add link", () => {
    renderSideNav();
    expect(screen.getAllByRole("navigation", { name: "Main" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Applications" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Add application" }).getAttribute("href")).toBe("/applications/new");
  });

  it("falls back to a neutral label when there is no email", () => {
    renderSideNav({ email: undefined });
    expect(screen.getByRole("button", { name: "Account: Your account" })).toBeTruthy();
  });

  it("returns focus to the account row after Escape", () => {
    renderSideNav();
    const row = screen.getByRole("button", { name: /Account/ });
    fireEvent.click(row);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(document.activeElement).toBe(row);
  });
});
