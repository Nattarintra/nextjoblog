import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: useActionStateMock };
});

vi.mock("@/app/actions/auth", () => ({
  login: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

import LoginForm from "@/app/login/LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    cleanup();
    useActionStateMock.mockReturnValue([undefined, vi.fn(), false]);
  });

  it("renders the login fields, links, and button", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log In" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign Up" })).toBeTruthy();
  });

  it("shows the generic invalid-credentials alert without revealing which field failed", () => {
    useActionStateMock.mockReturnValue([{ error: "invalid_credentials" }, vi.fn(), false]);
    render(<LoginForm />);

    expect(screen.getByRole("alert").textContent).toBe("Email or password is incorrect");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows the unknown-error alert with the server's message", () => {
    useActionStateMock.mockReturnValue([
      { error: "unknown", message: "Unable to log in. Please try again." },
      vi.fn(),
      false,
    ]);
    render(<LoginForm />);

    expect(screen.getByRole("alert").textContent).toBe("Unable to log in. Please try again.");
  });

  it("shows the pending state", () => {
    useActionStateMock.mockReturnValue([undefined, vi.fn(), true]);
    render(<LoginForm />);

    const button = screen.getByRole("button", { name: "Logging in…" });
    expect(button).toHaveProperty("disabled", true);
  });
});
