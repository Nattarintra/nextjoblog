import { cleanup, render, screen } from "@testing-library/react";
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
import { getPasswordValidationError } from "@/app/signup/password-validation";

describe("getPasswordValidationError", () => {
  it("returns an error for passwords under 6 characters", () => {
    expect(getPasswordValidationError("abc")).toBe("At least 6 characters");
  });

  it("returns null for passwords 6 characters or longer", () => {
    expect(getPasswordValidationError("abcdef")).toBeNull();
  });
});

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

  it("shows the duplicate email alert while keeping the fields visible", () => {
    useActionStateMock.mockReturnValue([{ error: "duplicate_email" }, vi.fn(), false]);
    render(<SignupForm />);

    expect(screen.getByRole("alert").textContent).toContain("already in use");
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
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
  });

  it("shows the pending state", () => {
    useActionStateMock.mockReturnValue([undefined, vi.fn(), true]);
    render(<SignupForm />);

    const button = screen.getByRole("button", { name: "Creating account…" });
    expect(button).toHaveProperty("disabled", true);
  });
});
