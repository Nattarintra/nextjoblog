import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: useActionStateMock };
});

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

vi.mock("@/app/actions/password-reset", () => ({
  requestPasswordResetAction: vi.fn(),
}));

import CheckYourEmailScreen from "@/app/forgot-password/CheckYourEmailScreen";
import ForgotPasswordFlow from "@/app/forgot-password/ForgotPasswordFlow";
import ForgotPasswordForm from "@/app/forgot-password/ForgotPasswordForm";
import TooManyRequestsScreen from "@/app/forgot-password/TooManyRequestsScreen";
import { formatCountdown, useCountdown } from "@/lib/hooks/use-countdown";

const noopAction = vi.fn();

describe("forgot-password screens", () => {
  beforeEach(() => {
    cleanup();
    useActionStateMock.mockReturnValue([undefined, noopAction, false]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the form with accessible validation wiring", () => {
    render(<ForgotPasswordForm action={noopAction} isPending={false} hasError onSubmit={noopAction} />);

    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("forgot-password-email-error");
    expect(screen.getByRole("alert").textContent).toContain("Enter a valid email address");
  });

  it("renders the neutral status and resend cooldown", () => {
    render(
      <CheckYourEmailScreen
        email="user@example.com"
        action={noopAction}
        isPending={false}
        resendGeneration={0}
        onUseDifferentEmail={noopAction}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("If this email exists in our system");
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Resend Link in 1:00" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Check Your Email" }));
  });

  it("restarts the resend cooldown when the generation changes", () => {
    vi.useFakeTimers();
    const props = {
      email: "user@example.com",
      action: noopAction,
      isPending: false,
      onUseDifferentEmail: noopAction,
    };

    const { rerender } = render(<CheckYourEmailScreen {...props} resendGeneration={0} />);
    act(() => vi.advanceTimersByTime(1_000));
    expect((screen.getByRole("button", { name: "Resend Link in 0:59" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(<CheckYourEmailScreen {...props} resendGeneration={1} />);
    expect((screen.getByRole("button", { name: "Resend Link in 1:00" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders the rate-limit alert and disables retry until the countdown ends", () => {
    render(
      <TooManyRequestsScreen
        email="user@example.com"
        retryAfterSeconds={60}
        action={noopAction}
        isPending={false}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("Please wait");
    expect(screen.getByText("1:00")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Request a New Link" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves the flow from the form to the neutral screen", async () => {
    const state = { status: "sent" as const, email: "user@example.com" };
    useActionStateMock.mockReturnValue([state, noopAction, false]);
    render(<ForgotPasswordFlow />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Check Your Email" })).toBeTruthy());
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("useCountdown", () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => vi.useRealTimers());

  it("formats minutes and seconds without going below zero", () => {
    expect(formatCountdown(892)).toBe("14:52");
    expect(formatCountdown(-1)).toBe("0:00");
  });

  it("ticks down with the injected interval", () => {
    const { result } = renderHook(() => useCountdown(2, 1_000));

    expect(result.current.formatted).toBe("0:02");
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.formatted).toBe("0:01");
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toMatchObject({ secondsLeft: 0, isFinished: true, formatted: "0:00" });
  });
});
