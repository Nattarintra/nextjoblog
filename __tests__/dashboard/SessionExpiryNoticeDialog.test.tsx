import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionExpiryNoticeDialog } from "@/app/(protected)/_components/SessionExpiryNoticeDialog";
import { formatSessionDate } from "@/app/(protected)/_components/session-date-formatting";

const { useActionStateMock, extendActionMock, refreshMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
  extendActionMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: useActionStateMock };
});

vi.mock("@/app/actions/session", () => ({ extendSession: extendActionMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

describe("SessionExpiryNoticeDialog", () => {
  beforeEach(() => {
    cleanup();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    useActionStateMock.mockReturnValue([undefined, extendActionMock, false]);
    extendActionMock.mockClear();
    refreshMock.mockClear();
  });

  it("dispatches the extension action from Yes", () => {
    render(<SessionExpiryNoticeDialog onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Yes, stay logged in" }));

    expect(extendActionMock).toHaveBeenCalledTimes(1);
  });

  it("dismisses from No without dispatching an extension", () => {
    const onDismiss = vi.fn();
    render(<SessionExpiryNoticeDialog onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(extendActionMock).not.toHaveBeenCalled();
  });

  it("dismisses and refreshes after a successful extension", () => {
    const onDismiss = vi.fn();
    useActionStateMock.mockReturnValue([
      { ok: true, extendedUntil: Date.now() + 30_000 },
      extendActionMock,
      false,
    ]);
    render(<SessionExpiryNoticeDialog onDismiss={onDismiss} />);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("renders a server error and keeps Yes enabled", () => {
    useActionStateMock.mockReturnValue([
      { error: "unknown", message: "Unable to extend the session. Please try again." },
      extendActionMock,
      false,
    ]);
    render(<SessionExpiryNoticeDialog onDismiss={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toBe(
      "We couldn't extend your login. Nothing changed. Check your connection and try again.",
    );
    expect(screen.getByRole("button", { name: "Try Again" })).toHaveProperty("disabled", false);
    expect(screen.queryByText("If yes")).toBeNull();
  });

  it("shows local current and proposed expiry dates", () => {
    const sessionExpiresAt = Date.UTC(2026, 10, 25, 9, 8);
    render(<SessionExpiryNoticeDialog sessionExpiresAt={sessionExpiresAt} onDismiss={vi.fn()} />);

    expect(screen.getByText("Ends in 2 days")).toBeTruthy();
    expect(screen.getByText(formatSessionDate(sessionExpiresAt))).toBeTruthy();
    expect(screen.getByText(formatSessionDate(sessionExpiresAt + 30 * 24 * 60 * 60 * 1000))).toBeTruthy();
  });

  it("renders a client error without dispatching when offline", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<SessionExpiryNoticeDialog onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Yes, stay logged in" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "We couldn't extend your login. Nothing changed. Check your connection and try again.",
    );
    expect(extendActionMock).not.toHaveBeenCalled();
  });

  it("renders the pending state while extending", () => {
    useActionStateMock.mockReturnValue([undefined, extendActionMock, true]);
    render(<SessionExpiryNoticeDialog onDismiss={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    const yesButton = screen.getByRole("button", { name: "Staying logged in…" });

    expect(yesButton).toHaveProperty("disabled", true);
    expect(dialog.getAttribute("aria-busy")).toBe("true");
  });

  it("wraps keyboard focus from Yes to No and back", () => {
    render(<SessionExpiryNoticeDialog onDismiss={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const noButton = screen.getByRole("button", { name: "Not now" });
    const yesButton = screen.getByRole("button", { name: "Yes, stay logged in" });

    yesButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(noButton);

    noButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(yesButton);
  });

  it("dismisses on Escape and exposes dialog accessibility state", () => {
    const onDismiss = vi.fn();
    render(<SessionExpiryNoticeDialog onDismiss={onDismiss} />);
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("session-expiry-notice-heading");
    expect(dialog.getAttribute("aria-busy")).toBe("false");
  });
});
