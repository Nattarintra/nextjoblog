import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
import NotFound from "@/app/not-found";

describe("NotFound", () => {
  it("renders the application empty state and app navigation", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Application" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /can't find this application/i })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Go to Dashboard" })[1].getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "View All Applications" }).getAttribute("href")).toBe("/applications");
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();
  });
});
