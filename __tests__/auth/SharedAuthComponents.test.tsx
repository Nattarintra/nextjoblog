import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { RequirementList } from "@/components/auth/RequirementList";
import { StatusSteps } from "@/components/auth/StatusSteps";

afterEach(cleanup);

describe("auth status components", () => {
  it("focuses the heading and exposes the requested live region", () => {
    render(
      <AuthStatusScreen tone="warning" icon={<span>!</span>} heading="Check Your Email" description="Look for the message." liveRegion="alert" />,
    );

    const heading = screen.getByRole("heading", { name: "Check Your Email" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("alert").textContent).toContain("Look for the message.");
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });

  it("renders ordered steps and requirement status text", () => {
    render(
      <>
        <StatusSteps steps={["Open the email", "Tap the link"]} />
        <RequirementList
          id="requirements"
          requirements={[{ label: "At least 6 characters", met: true, count: "6 / 6" }, { label: "Passwords match", met: false }]}
        />
      </>,
    );

    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByText("Open the email")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("6 / 6")).toBeTruthy();
    expect(screen.getByText("met")).toBeTruthy();
    expect(screen.getByText("not met")).toBeTruthy();
  });
});
