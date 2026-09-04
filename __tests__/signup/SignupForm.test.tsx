import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: useActionStateMock };
});

vi.mock("@/app/actions/auth", () => ({
  signup: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

import SignupForm from "@/app/signup/SignupForm";

describe("SignupForm", () => {
  beforeEach(() => {
    cleanup();
    useActionStateMock.mockReturnValue([undefined, vi.fn(), false]);
  });

  it("renders the signup fields, button, and footer link", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log In" })).toBeTruthy();
  });

  it("shows the duplicate email alert with a working Log In link, while keeping the fields visible", () => {
    useActionStateMock.mockReturnValue([{ error: "duplicate_email" }, vi.fn(), false]);
    render(<SignupForm />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("already in use");
    expect(within(alert).getByRole("link", { name: "Log In" })).toHaveProperty("href", expect.stringContaining("/login"));
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("shows the unknown-error alert with the server's message", () => {
    useActionStateMock.mockReturnValue([
      { error: "unknown", message: "Unable to create account. Please try again." },
      vi.fn(),
      false,
    ]);
    render(<SignupForm />);

    expect(screen.getByRole("alert").textContent).toBe("Unable to create account. Please try again.");
  });

  it("shows the weak-password helper when the server rejects the password, without any typing", () => {
    useActionStateMock.mockReturnValue([{ error: "weak_password" }, vi.fn(), false]);
    render(<SignupForm />);

    expect(screen.getAllByText("At least 6 characters")).toHaveLength(1);
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
  });

  it("blocks the action for a short password and shows an error", async () => {
    const action = vi.fn();
    useActionStateMock.mockReturnValue([undefined, action, false]);
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getAllByText("At least 6 characters")).toHaveLength(1);
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
  });

  it("calls the action once the password is long enough, clearing a prior short-password error", async () => {
    const action = vi.fn();
    useActionStateMock.mockReturnValue([undefined, action, false]);
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(action).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "abcdef");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("false");
  });

  it("shows the pending state", () => {
    useActionStateMock.mockReturnValue([undefined, vi.fn(), true]);
    render(<SignupForm />);

    const button = screen.getByRole("button", { name: "Creating account…" });
    expect(button).toHaveProperty("disabled", true);
  });
});
