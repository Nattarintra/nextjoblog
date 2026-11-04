import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useActionStateMock, action } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
  action: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: useActionStateMock };
});

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/app/actions/reset-password", () => ({ resetPasswordAction: action }));
import NewPasswordForm from "@/app/reset-password/NewPasswordForm";
import ResetLinkExpiredScreen from "@/app/reset-password/ResetLinkExpiredScreen";
import ResetPasswordFlow from "@/app/reset-password/ResetPasswordFlow";
const tokensHash = "#access_token=access-token&refresh_token=refresh-token&type=recovery";

describe("reset-password UI", () => {
  beforeEach(() => {
    cleanup();
    useActionStateMock.mockReturnValue([undefined, action, false]);
    action.mockReset();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the expired screen for a missing fragment and focuses its heading", async () => {
    const getHash = () => "";
    render(<ResetPasswordFlow getHash={getHash} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "This Reset Link No Longer Works" })).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("expired or was already used");
    expect(screen.getByRole("link", { name: "Request a New Link" }).getAttribute("href")).toBe("/forgot-password");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "This Reset Link No Longer Works" })),
    );
  });

  it("reads tokens, strips the fragment, and renders the form", async () => {
    const getHash = () => tokensHash;
    render(<ResetPasswordFlow getHash={getHash} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Set a New Password" })).toBeTruthy());
    expect(window.location.hash).toBe("");
    expect(screen.getByLabelText("New Password").getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getByLabelText("Confirm New Password").getAttribute("autocomplete")).toBe("new-password");
  });

  it("blocks short and mismatched submissions before the action", async () => {
    const user = userEvent.setup();
    render(
      <NewPasswordForm
        action={action}
        accessToken="access-token"
        refreshToken="refresh-token"
        state={undefined}
        isPending={false}
      />,
    );

    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm New Password"), "different");
    await user.click(screen.getByRole("button", { name: "Save New Password" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Use at least 6 characters");
  });

  it("marks unmet password requirements with the warning color", async () => {
    const user = userEvent.setup();
    render(
      <NewPasswordForm
        action={action}
        accessToken="access-token"
        refreshToken="refresh-token"
        state={undefined}
        isPending={false}
      />,
    );

    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm New Password"), "different");

    expect(screen.getByLabelText("New Password").className).toContain("border-auth-danger");
    expect(screen.getByLabelText("Confirm New Password").className).toContain("border-auth-danger");
    expect(screen.getByText("At least 6 characters").parentElement?.className).toContain("text-auth-danger");
    expect(screen.getByText("Both passwords match").parentElement?.className).toContain("text-auth-danger");
  });

  it("shows the offline message without calling the action", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(
      <NewPasswordForm
        action={action}
        accessToken="access-token"
        refreshToken="refresh-token"
        state={undefined}
        isPending={false}
      />,
    );

    await user.type(screen.getByLabelText("New Password"), "valid-password");
    await user.type(screen.getByLabelText("Confirm New Password"), "valid-password");
    await user.click(screen.getByRole("button", { name: "Save New Password" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("offline");
  });

  it("renders the provider error and keeps the fields available", () => {
    render(
      <NewPasswordForm
        action={action}
        accessToken="access-token"
        refreshToken="refresh-token"
        state={{ status: "same_password" }}
        isPending={false}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("different from your current password");
    expect(screen.getByLabelText("New Password")).toBeTruthy();
  });

  it("moves an expired action result to the expired screen", async () => {
    useActionStateMock.mockReturnValue([{ status: "expired" }, action, false]);
    render(<ResetPasswordFlow getHash={() => tokensHash} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "This Reset Link No Longer Works" })).toBeTruthy());
  });

  it("renders a pending button with an accessible busy state", () => {
    render(
      <NewPasswordForm
        action={action}
        accessToken="access-token"
        refreshToken="refresh-token"
        state={undefined}
        isPending
      />,
    );

    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("renders the expired screen links and keyboard-focusable heading", () => {
    render(<ResetLinkExpiredScreen />);
    expect(screen.getByRole("link", { name: "Back to Log In" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("heading").getAttribute("tabindex")).toBe("-1");
    act(() => undefined);
  });
});
