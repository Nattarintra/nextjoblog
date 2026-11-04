import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordUpdatedToast } from "@/app/(protected)/_components/PasswordUpdatedToast";
import {
  PASSWORD_UPDATED_TOAST_DISMISS_MS,
  PASSWORD_UPDATED_TOAST_FLAG,
} from "@/lib/auth/password-reset-confirm-config";

describe("PasswordUpdatedToast", () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it("shows once, clears its flag, and can be dismissed", () => {
    sessionStorage.setItem(PASSWORD_UPDATED_TOAST_FLAG, "1");
    render(
      <StrictMode>
        <PasswordUpdatedToast />
      </StrictMode>,
    );

    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("status").textContent).toContain("Password updated");
    expect(sessionStorage.getItem(PASSWORD_UPDATED_TOAST_FLAG)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss password-updated message" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("auto-dismisses after the shared delay", () => {
    sessionStorage.setItem(PASSWORD_UPDATED_TOAST_FLAG, "1");
    render(<PasswordUpdatedToast />);
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(PASSWORD_UPDATED_TOAST_DISMISS_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("promotes the one-time Server Action cookie into the client toast state", () => {
    document.cookie = `${PASSWORD_UPDATED_TOAST_FLAG}=1; Path=/`;
    render(<PasswordUpdatedToast />);
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("status").textContent).toContain("Password updated");
    expect(document.cookie).not.toContain(`${PASSWORD_UPDATED_TOAST_FLAG}=1`);
  });

  it("shows when the protected server shell observes the action cookie", () => {
    render(<PasswordUpdatedToast serverFlag />);
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("status").textContent).toContain("Password updated");
  });

  it("does not fail when session storage is unavailable", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    render(<PasswordUpdatedToast />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.queryByRole("status")).toBeNull();
    getItem.mockRestore();
  });
});
