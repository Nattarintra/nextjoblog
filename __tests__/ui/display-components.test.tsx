import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { APPLICATION_STATUSES } from "@/lib/applications/types";
import { STATUS_DISPLAY } from "@/lib/applications/status";

afterEach(cleanup);

describe("Button", () => {
  it("defaults to type=button and applies variant and size classes", () => {
    render(<Button variant="danger" size="sm">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toBe(buttonClassName({ variant: "danger", size: "sm" }));
  });

  it("is disabled and relabelled while pending", () => {
    render(<Button type="submit" pending>Save</Button>);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Saving…" });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("supports a custom pending label, full width and extra classes", () => {
    render(<Button pending pendingLabel="Wait" fullWidth className="extra">Go</Button>);
    const { classList } = screen.getByRole("button", { name: "Wait" });
    expect(classList.contains("w-full") && classList.contains("extra")).toBe(true);
  });

  it("can be disabled without pending", () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Go" }).disabled).toBe(true);
  });

  it("ButtonLink renders a link with button styling", () => {
    render(<ButtonLink href="/applications/new" variant="secondary" fullWidth className="x">Add</ButtonLink>);
    const link = screen.getByRole("link", { name: "Add" });
    expect(link.getAttribute("href")).toBe("/applications/new");
    expect(link.classList.contains("w-full") && link.classList.contains("x")).toBe(true);
  });

  it("uses the default style when no options are given", () => {
    expect(buttonClassName()).toContain("bg-azure");
  });
});

describe("Card, SectionLabel, PageHeader", () => {
  it("Card renders children, optional padding and element type", () => {
    const { container } = render(<Card as="section" padded className="extra">Body</Card>);
    const { classList } = container.querySelector("section")!;
    expect(classList.contains("p-4") && classList.contains("extra")).toBe(true);
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("Card is unpadded by default", () => {
    const { container } = render(<Card>Body</Card>);
    expect((container.firstChild as HTMLElement).classList.contains("p-4")).toBe(false);
  });

  it("SectionLabel shows hint and action", () => {
    render(<SectionLabel hint="optional" action={<a href="#x">Edit</a>}>Job details</SectionLabel>);
    expect(screen.getByRole("heading", { name: "Job details" })).toBeTruthy();
    expect(screen.getByText("optional")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" })).toBeTruthy();
  });

  it("SectionLabel works with just a title", () => {
    render(<SectionLabel>Required</SectionLabel>);
    expect(screen.getByRole("heading", { name: "Required" })).toBeTruthy();
  });

  it("PageHeader renders title, subtitle, back link and actions", () => {
    render(<PageHeader title="Add application" subtitle="Fields marked are required" backHref="/applications" actions={<button>Save</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Add application" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/applications");
    expect(screen.getByText("Fields marked are required")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("PageHeader omits optional parts", () => {
    render(<PageHeader title="Applications" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("Alert and ErrorSummary", () => {
  it("danger alerts use role=alert and show an action", () => {
    render(<Alert tone="danger" title="Couldn't save." action={<button>Retry</button>}>Everything is still here.</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Couldn't save.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it.each(["warning", "success", "info"] as const)("%s alerts use role=status", (tone) => {
    render(<Alert tone={tone}>Note</Alert>);
    expect(screen.getByRole("status").textContent).toContain("Note");
  });

  it("ErrorSummary links move focus to the invalid field", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ErrorSummary heading="2 fields need attention" items={[{ fieldId: "field-company", message: "Enter the company" }, { fieldId: "field-missing", message: "Gone" }]} />
        <input id="field-company" aria-label="company" />
      </>,
    );
    expect(screen.getByRole("alert").textContent).toContain("2 fields need attention");
    await user.click(screen.getByRole("link", { name: "Enter the company" }));
    expect(document.activeElement).toBe(screen.getByLabelText("company"));
    await user.click(screen.getByRole("link", { name: "Gone" }));
  });
});

describe("StatusBadge and EmptyState", () => {
  it.each(APPLICATION_STATUSES)("StatusBadge renders the label for %s", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(STATUS_DISPLAY[status].label)).toBeTruthy();
  });

  it("EmptyState shows title, description and action", () => {
    render(<EmptyState icon="list" title="No applications yet" description="Start here" action={<a href="/new">Add</a>} />);
    expect(screen.getByRole("heading", { name: "No applications yet" })).toBeTruthy();
    expect(screen.getByText("Start here")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add" })).toBeTruthy();
  });

  it("EmptyState works without an action", () => {
    render(<EmptyState icon="list" title="Empty" description="d" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
