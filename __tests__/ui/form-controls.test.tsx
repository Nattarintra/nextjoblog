import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatePicker } from "@/components/ui/DatePicker";
import { fieldId } from "@/components/ui/field-ids";
import { FormField, useFormFieldControl } from "@/components/ui/FormField";
import { TextInput } from "@/components/ui/TextInput";

const TODAY = "2026-11-19";

function hiddenValue(container: HTMLElement, selector: string): string {
  return (container.querySelector(selector) as HTMLInputElement).value;
}

function Field({ error, help }: { error?: string; help?: string }) {
  return (
    <FormField name="company" label="Company" required error={error} help={help}>
      <TextInput defaultValue="Spotify" />
    </FormField>
  );
}

afterEach(cleanup);

describe("FormField + TextInput", () => {
  it("labels the input, marks it required and exposes the shared id", () => {
    render(<Field />);
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: /company/i });
    expect(input.getAttribute("id")).toBe(fieldId("company"));
    expect(input.getAttribute("name")).toBe("company");
    expect(input.required).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });

  it("links help and error text through aria-describedby", () => {
    render(<Field help="Help text" error="Enter the company" />);
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const descriptionIds = input.getAttribute("aria-describedby")!.split(" ");
    const description = descriptionIds.map((id) => document.getElementById(id)?.textContent).join(" ");
    expect(description).toContain("Help text");
    expect(description).toContain("Enter the company");
  });

  it("throws when a control is rendered outside a FormField", () => {
    const Orphan = () => { useFormFieldControl(); return null; };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/FormField/);
  });
});

describe("DatePicker", () => {
  function renderPicker(props: Partial<React.ComponentProps<typeof DatePicker>> = {}) {
    return render(
      <form aria-label="f">
        <FormField name="applied_date" label="Applied date" required help="Defaults to today.">
          <DatePicker today={TODAY} defaultValue={TODAY} {...props} />
        </FormField>
      </form>,
    );
  }
  const trigger = () => screen.getByRole("button", { name: /applied date/i });

  it("shows the default date and posts it as ISO through a hidden input", () => {
    const { container } = renderPicker();
    expect(trigger().textContent).toContain("19 Nov 2026");
    expect(hiddenValue(container, 'input[type="hidden"][name="applied_date"]')).toBe(TODAY);
    expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows a placeholder when empty", () => {
    renderPicker({ defaultValue: "" });
    expect(trigger().textContent).toContain("Select a date");
  });

  it.each([["click"], ["Enter"], ["Space"]])("opens on %s", async (how) => {
    const user = userEvent.setup();
    renderPicker();
    if (how === "click") await user.click(trigger());
    else { trigger().focus(); await user.keyboard(how === "Enter" ? "{Enter}" : " "); }
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("selects a future date, updates the hidden input and returns focus", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = renderPicker({ onChange });
    await user.click(trigger());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /25th/i }));
    expect(onChange).toHaveBeenCalledWith("2026-11-25");
    expect(hiddenValue(container, 'input[type="hidden"]')).toBe("2026-11-25");
    expect(trigger().textContent).toContain("25 Nov 2026");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("moves between days with the arrow keys and picks with Enter", async () => {
    const user = userEvent.setup();
    const { container } = renderPicker();
    await user.click(trigger());
    await user.keyboard("{ArrowRight}{Enter}");
    expect(hiddenValue(container, 'input[type="hidden"]')).toBe("2026-11-20");
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on an outside pointer press but not an inside one", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(trigger());
    await user.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores typing on the trigger and toggles closed on a second click", async () => {
    const user = userEvent.setup();
    const { container } = renderPicker();
    trigger().focus();
    await user.keyboard("abc");
    expect(hiddenValue(container, 'input[type="hidden"]')).toBe(TODAY);
    await user.click(trigger());
    await user.click(trigger());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("navigates months with labelled buttons", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText(/December 2026/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText(/November 2026/)).toBeTruthy();
  });

  it("describes the trigger with help and error text", () => {
    render(
      <FormField name="applied_date" label="Applied date" error="Enter a valid date">
        <DatePicker today={TODAY} />
      </FormField>,
    );
    const describedBy = screen.getByRole("button", { name: /applied date/i }).getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toContain("Enter a valid date");
  });
});
