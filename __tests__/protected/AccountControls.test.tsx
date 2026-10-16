import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { logoutState } = vi.hoisted(() => ({
  logoutState: { logout: vi.fn(), errorMessage: null as string | null, isPending: false },
}));

vi.mock("@/app/(protected)/_components/useLogout", () => ({ useLogout: () => logoutState }));

import { AccountControls } from "@/app/(protected)/_components/AccountControls";
import { AppTopBar } from "@/app/(protected)/_components/AppTopBar";

describe("AccountControls", () => {
  beforeEach(() => {
    cleanup();
    logoutState.logout = vi.fn();
    logoutState.errorMessage = null;
    logoutState.isPending = false;
  });

  it("renders the desktop identity and an inline Log Out wired to the shared hook", () => {
    render(<AppTopBar email="ada@example.com" />);
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    expect(logoutState.logout).toHaveBeenCalledTimes(1);
  });

  it("shows pending and error states on the inline button", () => {
    logoutState.errorMessage = "still in";
    const { rerender } = render(<AccountControls email="ada@example.com" />);
    expect(screen.getByRole("alert").textContent).toContain("still in");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();

    logoutState.isPending = true;
    rerender(<AccountControls email="ada@example.com" />);
    expect((screen.getByRole("button", { name: "Logging out…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the same logout control when the sheet is opened and closed", () => {
    render(<AccountControls email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    const [sheetLogout] = screen.getAllByRole("button", { name: "Log Out" });
    fireEvent.click(sheetLogout);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(logoutState.logout).toHaveBeenCalledTimes(1);
  });
});
