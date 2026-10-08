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

    expect(screen.getByRole("heading", { name: "Log In" })).toBeTruthy();
    expect(screen.getByDisplayValue("/dashboard")).toHaveProperty("type", "hidden");
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log In" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign Up" })).toBeTruthy();
  });

  it("shows the return destination and carries the safe path in the hidden field", () => {
    render(<LoginForm nextPath="/applications/123?tab=notes" destinationLabel="An application" />);

    expect(screen.getByRole("heading", { name: "Log In to Continue" })).toBeTruthy();
    expect(screen.getByText("You need to be logged in to open this page.")).toBeTruthy();
    expect(screen.getByText("You'll return to the page you opened")).toBeTruthy();
    expect(screen.getByText("An application")).toBeTruthy();
    expect(screen.getByDisplayValue("/applications/123?tab=notes")).toHaveProperty("type", "hidden");
  });

  it("does not show a return strip when there is no destination label", () => {
    render(<LoginForm nextPath="/dashboard" />);

    expect(screen.queryByText("You'll return to the page you opened")).toBeNull();
    expect(screen.getByText("Log your job applications and track every step in one place.")).toBeTruthy();
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

  it("shows the confirmation-required alert without marking the fields invalid", () => {
    useActionStateMock.mockReturnValue([{ status: "confirmation_required" }, vi.fn(), false]);
    render(<LoginForm />);

    expect(screen.getByRole("alert").textContent).toContain("verify your email");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("false");
  });

  it("shows the configuration-error alert without exposing provider details", () => {
    useActionStateMock.mockReturnValue([{ error: "configuration" }, vi.fn(), false]);
    render(<LoginForm />);

    expect(screen.getByRole("alert").textContent).toBe(
      "We're unable to log in right now. Please try again shortly.",
    );
  });
});
