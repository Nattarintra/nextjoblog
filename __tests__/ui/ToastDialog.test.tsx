import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/Dialog";
import { Toast } from "@/components/ui/Toast";

afterEach(cleanup);

describe("Toast", () => {
  it("renders its status content and dismisses through the close button", () => {
    const onDismiss = vi.fn();
    render(<Toast title="Password updated" body="You're logged in." dismissLabel="Dismiss message" onDismiss={onDismiss} />);

    expect(screen.getByRole("status").textContent).toContain("Password updated");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("Dialog", () => {
  function TestDialog({ busy = false, tone = "light", onEscape = vi.fn() }: { busy?: boolean; tone?: "light" | "dark"; onEscape?: () => void }) {
    const firstRef = useRef<HTMLButtonElement>(null);
    const lastRef = useRef<HTMLButtonElement>(null);
    return (
      <Dialog
        labelledBy="dialog-heading"
        busy={busy}
        tone={tone}
        firstFocusableRef={firstRef}
        lastFocusableRef={lastRef}
        onEscape={onEscape}
      >
        <h2 id="dialog-heading">Account</h2>
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
});
