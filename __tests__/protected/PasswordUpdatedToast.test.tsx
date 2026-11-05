import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordUpdatedToast } from "@/app/(protected)/_components/PasswordUpdatedToast";
import {
  PASSWORD_UPDATED_TOAST_COOKIE_PATH,
  PASSWORD_UPDATED_TOAST_DISMISS_MS,
  PASSWORD_UPDATED_TOAST_FLAG,
  PASSWORD_UPDATED_TOAST_FLAG_VALUE,
} from "@/lib/auth/password-reset-confirm-config";

const TOAST_COOKIE = `${PASSWORD_UPDATED_TOAST_FLAG}=${PASSWORD_UPDATED_TOAST_FLAG_VALUE}`;

function setToastCookie() {
  document.cookie = `${TOAST_COOKIE}; Path=${PASSWORD_UPDATED_TOAST_COOKIE_PATH}`;
}

describe("PasswordUpdatedToast", () => {
  beforeEach(() => {
    cleanup();
    document.cookie = `${PASSWORD_UPDATED_TOAST_FLAG}=; Max-Age=0; Path=${PASSWORD_UPDATED_TOAST_COOKIE_PATH}`;
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it("shows once, clears its flag, and can be dismissed", () => {
    setToastCookie();
    render(
      <StrictMode>
        <PasswordUpdatedToast />
      </StrictMode>,
    );

    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("status").textContent).toContain("Password updated");
    expect(document.cookie).not.toContain(TOAST_COOKIE);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss password-updated message" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("auto-dismisses after the shared delay", () => {
    setToastCookie();
    render(<PasswordUpdatedToast />);
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(PASSWORD_UPDATED_TOAST_DISMISS_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("promotes the one-time Server Action cookie into the client toast state", () => {
    setToastCookie();
    render(<PasswordUpdatedToast />);
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("status").textContent).toContain("Password updated");
    expect(document.cookie).not.toContain(TOAST_COOKIE);
  });

  it("shows when the protected server shell observes the action cookie", () => {
    render(<PasswordUpdatedToast serverFlag />);
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("status").textContent).toContain("Password updated");
  });

  it("stays hidden when there is no flag", () => {
    render(<PasswordUpdatedToast />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
