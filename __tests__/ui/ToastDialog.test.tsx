import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/Dialog";
import { Toast } from "@/components/ui/Toast";
import { SessionExtensionToast } from "@/app/(protected)/_components/SessionExtensionToast";

afterEach(cleanup);

describe("Toast", () => {
  it("renders its status content and dismisses through the close button", () => {
    const onDismiss = vi.fn();
    render(<Toast title="Password updated" body="You're logged in." dismissLabel="Dismiss message" onDismiss={onDismiss} />);

    expect(screen.getByRole("status").textContent).toContain("Password updated");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("uses the server-confirmed expiry in the extension message", () => {
    const onDismiss = vi.fn();
    const extendedUntil = Date.UTC(2026, 11, 25, 9, 8);
    render(<SessionExtensionToast extendedUntil={extendedUntil} onDismiss={onDismiss} />);

    expect(screen.getByRole("status").textContent).toContain("You'll stay logged in");
    expect(screen.getByRole("status").textContent).toContain(new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(extendedUntil));
  });
});

describe("Dialog", () => {
  function TestDialog({ busy = false, tone = "light", onEscape = vi.fn(), onBackdropClick = vi.fn() }: { busy?: boolean; tone?: "light" | "dark"; onEscape?: () => void; onBackdropClick?: () => void }) {
    const firstRef = useRef<HTMLButtonElement>(null);
    const lastRef = useRef<HTMLButtonElement>(null);
    return (
      <Dialog
        labelledBy="dialog-heading"
        describedBy="dialog-description"
        busy={busy}
        tone={tone}
        firstFocusableRef={firstRef}
        lastFocusableRef={lastRef}
        onEscape={onEscape}
        onBackdropClick={onBackdropClick}
      >
        <h2 id="dialog-heading">Account</h2>
        <p id="dialog-description">Account controls</p>
        <button ref={firstRef} type="button">First</button>
        <button ref={lastRef} type="button">Last</button>
      </Dialog>
    );
  }

  it("labels dark and busy dialogs", () => {
    render(<TestDialog busy tone="dark" />);
    const dialog = screen.getByRole("dialog", { name: "Account" });
    expect(dialog.getAttribute("data-surface")).toBe("dark");
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBe("dialog-description");
  });

  it("handles Escape and wraps Tab navigation at both ends", () => {
    const onEscape = vi.fn();
    render(<TestDialog onEscape={onEscape} />);
    const dialog = screen.getByRole("dialog");
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledOnce();

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus when focus escapes the dialog", () => {
    render(
      <>
        <button type="button">Outside</button>
        <TestDialog />
      </>,
    );

    const first = screen.getByRole("button", { name: "First" });
    screen.getByRole("button", { name: "Outside" }).focus();
    expect(document.activeElement).toBe(first);
  });

  it("dismisses only when the backdrop is clicked and restores the opener", () => {
    const onBackdropClick = vi.fn();
    const opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<TestDialog onBackdropClick={onBackdropClick} />);
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;

    fireEvent.mouseDown(dialog);
    expect(onBackdropClick).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop!);
    expect(onBackdropClick).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
