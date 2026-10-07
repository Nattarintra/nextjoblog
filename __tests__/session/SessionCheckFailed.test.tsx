import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));

import { SessionCheckFailed } from "@/app/(protected)/_components/SessionCheckFailed";

describe("SessionCheckFailed", () => {
  it("focuses the heading and renders accessible recovery controls", () => {
    render(<SessionCheckFailed loginHref="/login?next=%2Fdashboard" />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /couldn't verify/i }));
    expect(screen.getByRole("list").querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Go to Log In" }).getAttribute("href")).toBe("/login?next=%2Fdashboard");
    expect(screen.getByText("No application data was loaded")).toBeTruthy();
  });

  it("refreshes the route when Try Again is pressed", () => {
    cleanup();
    render(<SessionCheckFailed loginHref="/login" />);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("Still unable to verify your session");
  });
});
