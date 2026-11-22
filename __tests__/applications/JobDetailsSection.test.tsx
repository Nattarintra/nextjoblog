import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/applications", () => ({ logApplicationAction: vi.fn() }));

import { ApplicationForm } from "@/app/(protected)/applications/new/_components/ApplicationForm";
import { initialFormValues } from "@/lib/applications/form-view";
import type { ApplicationFormState } from "@/lib/applications/types";

const TODAY = "2026-11-19";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

afterEach(cleanup);

function renderForm(submit = vi.fn<(state: ApplicationFormState, data: FormData) => Promise<ApplicationFormState>>()) {
  render(<ApplicationForm today={TODAY} clientId={CLIENT_ID} initialValues={initialFormValues(TODAY)} submit={submit} />);
  return submit;
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: /^title/i }), "Frontend Engineer");
  await user.type(screen.getByRole("textbox", { name: /^company/i }), "Spotify");
  await user.type(screen.getByRole("textbox", { name: /^location/i }), "Remote");
  await user.type(screen.getByRole("textbox", { name: /job posting link/i }), "https://jobs.spotify.com/1");
}

async function chooseDate(user: ReturnType<typeof userEvent.setup>, field: RegExp, day: RegExp) {
  await user.click(screen.getByRole("button", { name: field }));
  const dialog = screen.getByRole("dialog");
  await user.click(Array.from(dialog.querySelectorAll("button")).find((button) => day.test(button.getAttribute("aria-label") ?? ""))!);
}

describe("JobDetailsSection", () => {
  it("shows the closing warning and clears it when the date is cleared", async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseDate(user, /closing date/i, /15th/);
    expect(screen.getByText("Closing date is before the applied date — double check (you can still save)")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /closing date/i }));
    await user.click(screen.getByRole("button", { name: "Clear date" }));
    expect(screen.queryByText("Closing date is before the applied date")).toBeNull();
  });

  it("recomputes the warning when the applied date moves after the closing date", async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseDate(user, /closing date/i, /20th/);
    expect(screen.queryByText("Closing date is before the applied date")).toBeNull();

    await chooseDate(user, /applied date/i, /25th/);
    expect(screen.getByText("Closing date is before the applied date — double check (you can still save)")).toBeTruthy();
  });

  it("does not block saving while the warning is visible and posts repeated tags", async () => {
    const user = userEvent.setup();
    const submit = renderForm(vi.fn().mockResolvedValue({ status: "error", values: initialFormValues(TODAY) }));
    await fillRequired(user);
    await chooseDate(user, /closing date/i, /15th/);
    await user.type(screen.getByRole("textbox", { name: "Required technologies" }), "React{Enter}TypeScript{Enter}");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    const data = submit.mock.calls[0][1];
    expect(data.getAll("tech_stack")).toEqual(["React", "TypeScript"]);
    expect(data.get("closing_date")).toBe("2026-11-15");
  });

  it("re-seeds optional controls from the returned values after an invalid save", async () => {
    const user = userEvent.setup();
    const initial = initialFormValues(TODAY);
    const submit = vi.fn(async (_state: ApplicationFormState, data: FormData): Promise<ApplicationFormState> => ({
      status: "invalid",
      errors: { salary_info: "Check the salary" },
      values: {
        ...initial,
        closing_date: String(data.get("closing_date")),
        salary_info: String(data.get("salary_info")),
        work_format: String(data.get("work_format")),
        tech_stack: data.getAll("tech_stack").filter((entry): entry is string => typeof entry === "string"),
      },
    }));
    renderForm(submit);
    await fillRequired(user);
    await user.type(screen.getByRole("textbox", { name: "Salary" }), "50,000 SEK");
    await user.click(screen.getByLabelText("Remote"));
    await user.type(screen.getByRole("textbox", { name: "Required technologies" }), "React{Enter}");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("Check the salary")).length).toBe(2);
    expect((screen.getByRole("textbox", { name: "Salary" }) as HTMLInputElement).value).toBe("50,000 SEK");
    expect((screen.getByLabelText("Remote") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("React")).toBeTruthy();
  });
});
