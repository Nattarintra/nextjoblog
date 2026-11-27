import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import ApplicationNotFound from "@/app/(protected)/applications/[id]/not-found";

afterEach(cleanup);

describe("ApplicationNotFound", () => {
  it("renders the design-specific recovery state", () => {
    render(<ApplicationNotFound />);

    expect(screen.getByRole("heading", { name: "Application not found" })).toBeTruthy();
    expect(screen.getByText("It may have been deleted, or the link may be wrong.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to applications" }).getAttribute("href")).toBe("/applications");
    expect(screen.getByRole("link", { name: "Go to Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("main")).toBeTruthy();
  });
});
