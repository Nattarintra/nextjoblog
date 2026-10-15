import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock, logoutState } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  logoutState: { logout: vi.fn(), errorMessage: null as string | null, isPending: false },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock }) }));
vi.mock("@/app/(protected)/_components/useLogout", () => ({ useLogout: () => logoutState }));

import { AccountMenu } from "@/app/(protected)/_components/AccountMenu";

describe("AccountMenu / AccountSheet", () => {
  beforeEach(() => {
    cleanup();
    logoutState.logout = vi.fn();
    logoutState.errorMessage = null;
    logoutState.isPending = false;
  });

  it("exposes an accessible trigger and toggles aria-expanded", () => {
    render(<AccountMenu email="ada@example.com" />);
    const trigger = screen.getByRole("button", { name: "Account" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("renders the email, initial and device note", () => {
    render(<AccountMenu email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("Logged in on this device")).toBeTruthy();
  });

  it("falls back to a neutral label when the email is undefined", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByText("Your account")).toBeTruthy();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("focuses Log Out on open and calls logout on click", () => {
    render(<AccountMenu email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    const logout = screen.getByRole("button", { name: "Log Out" });
    expect(document.activeElement).toBe(logout);
    fireEvent.click(logout);
    expect(logoutState.logout).toHaveBeenCalledTimes(1);
  });

  it("is disabled and aria-busy while pending", () => {
    logoutState.isPending = true;
    render(<AccountMenu email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    const button = screen.getByRole("button", { name: "Logging out…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("dialog").getAttribute("aria-busy")).toBe("true");
  });

  it("shows the error alert and a Try Again label after a failure", () => {
    logoutState.errorMessage = "still in";
    render(<AccountMenu email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("alert").textContent).toContain("still in");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<AccountMenu email="ada@example.com" />);
    const trigger = screen.getByRole("button", { name: "Account" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes with the Close button", () => {
    render(<AccountMenu email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("traps Tab between Log Out and Close", () => {
    render(<AccountMenu email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    const close = screen.getByRole("button", { name: "Close" });
    act(() => close.focus());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Log Out" }));
  });

  it("closes the sheet when suspended by the expiry notice", () => {
    const { rerender } = render(<AccountMenu email="ada@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    rerender(<AccountMenu email="ada@example.com" suspended />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Account" }));
    rerender(<AccountMenu email="ada@example.com" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
