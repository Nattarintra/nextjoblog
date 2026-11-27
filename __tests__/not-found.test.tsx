import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
import NotFound from "@/app/not-found";

describe("NotFound", () => {
  it("renders generic 404 copy with a dashboard recovery link", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The page does not exist" })).toBeTruthy();
    expect(screen.getByText(/check the address/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByText(/application/i)).toBeNull();
  });
});
