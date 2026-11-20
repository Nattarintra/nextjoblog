import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/applications", () => ({ logApplicationAction: vi.fn() }));

import { ApplicationForm } from "@/app/(protected)/applications/new/_components/ApplicationForm";
import { initialFormValues } from "@/lib/applications/form-view";
import { APPLICATION_MESSAGES } from "@/lib/applications/messages";
import type { ApplicationFormState } from "@/lib/applications/types";

const TODAY = "2026-11-19";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

function renderForm(submit = vi.fn<(s: ApplicationFormState, f: FormData) => Promise<ApplicationFormState>>()) {
  render(<ApplicationForm today={TODAY} clientId={CLIENT_ID} initialValues={initialFormValues(TODAY)} submit={submit} />);
  return submit;
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: /^title/i }), "Frontend Engineer");
  await user.type(screen.getByRole("textbox", { name: /^company/i }), "Spotify");
  await user.type(screen.getByRole("textbox", { name: /^location/i }), "Remote");
  await user.type(screen.getByRole("textbox", { name: /job posting link/i }), "https://jobs.spotify.com/1");
}

afterEach(cleanup);

describe("ApplicationForm", () => {
  it("pre-fills the applied date with today", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /applied date/i }).textContent).toContain("19 Nov 2026");
  });

  it("shows a message per missing field, an error summary and focuses the first invalid field", async () => {
    const submit = renderForm();
    await userEvent.setup().click(screen.getByRole("button", { name: APPLICATION_MESSAGES.save }));

    // Inputs remount per submission, so query again after the submit.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /^title/i })));
    for (const name of [/^title/i, /^company/i, /^location/i, /job posting link/i]) {
      const input = screen.getByRole("textbox", { name });
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toMatch(/enter|isn't/i);
    }
    expect(screen.getByText("4 fields need attention before saving")).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it("explains an invalid link with an https example", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    const link = screen.getByRole("textbox", { name: /job posting link/i });
    await user.clear(link);
    await user.type(link, "linkedin job");
    await user.click(screen.getByRole("button", { name: APPLICATION_MESSAGES.save }));
    expect(await screen.findAllByText(/https:\/\//)).not.toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /job posting link/i }));
  });

  it("submits valid input with the client id, also on Enter", async () => {
    const submit = renderForm(vi.fn().mockResolvedValue({ status: "error", values: initialFormValues(TODAY) }));
    const user = createUser();
    await fillValid(user);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    const data = submit.mock.calls[0][1];
    expect(data.get("client_id")).toBe(CLIENT_ID);
    expect(data.get("title")).toBe("Frontend Engineer");
    expect(data.get("applied_date")).toBe(TODAY);
  });

  it("keeps input after a failed save and Retry resubmits it", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    renderForm(submit);
    await fillValid(user);
    submit.mockImplementation(async (_s, data: FormData) => ({
      status: "error",
      values: Object.fromEntries(["title", "company", "applied_date", "location", "posting_url"].map((k) => [k, String(data.get(k))])),
    }));
    await user.click(screen.getByRole("button", { name: APPLICATION_MESSAGES.save }));

    expect(await screen.findByText(/couldn't save/i)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: /^company/i }) as HTMLInputElement).value).toBe("Spotify");

    await user.click(screen.getByRole("button", { name: APPLICATION_MESSAGES.retry }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit.mock.calls[1][1].get("company")).toBe("Spotify");
  });

  it("disables Save while the submission is pending", async () => {
    const user = userEvent.setup();
    let release: (state: ApplicationFormState) => void = () => {};
    renderForm(vi.fn(() => new Promise<ApplicationFormState>((resolve) => (release = resolve))));
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: APPLICATION_MESSAGES.save }));
    const pending = await screen.findByRole("button", { name: /saving/i });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    release({ status: "error", values: initialFormValues(TODAY) });
  });
});

function createUser() {
  return userEvent.setup();
}
