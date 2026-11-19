import { describe, expect, it, vi } from "vitest";

import { withClientValidation } from "@/lib/applications/client-submit";
import { firstInvalidField, initialFormValues, orderedErrors, resolveFormView } from "@/lib/applications/form-view";
import { buildNewApplicationDefaults } from "@/lib/applications/new-application-defaults";
import { DEFAULT_TIME_ZONE } from "@/lib/applications/limits";

const TODAY = "2026-11-19";
const VALID = { title: "Dev", company: "Acme", applied_date: TODAY, location: "Lund", posting_url: "https://acme.test/1" };

function formDataOf(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("form view helpers", () => {
  it("starts empty except for today's date", () => {
    expect(initialFormValues(TODAY)).toEqual({ title: "", company: "", applied_date: TODAY, location: "", posting_url: "" });
  });

  it("shows initial values before any submission", () => {
    const initial = initialFormValues(TODAY);
    expect(resolveFormView(undefined, initial)).toEqual({ values: initial, errors: {}, saveFailed: false });
  });

  it("keeps submitted values and errors after an invalid submission", () => {
    const view = resolveFormView({ status: "invalid", errors: { company: "x" }, values: VALID }, initialFormValues(TODAY));
    expect(view).toEqual({ values: VALID, errors: { company: "x" }, saveFailed: false });
  });

  it("flags a failed save and keeps the values", () => {
    const view = resolveFormView({ status: "error", values: VALID }, initialFormValues(TODAY));
    expect(view).toEqual({ values: VALID, errors: {}, saveFailed: true });
  });

  it("orders errors and finds the first invalid field in form order", () => {
    const errors = { posting_url: "link", title: "title" };
    expect(firstInvalidField(errors)).toBe("title");
    expect(orderedErrors(errors)).toEqual([{ field: "title", message: "title" }, { field: "posting_url", message: "link" }]);
    expect(firstInvalidField({})).toBeUndefined();
  });
});

describe("withClientValidation", () => {
  it("returns errors without calling submit when input is invalid", async () => {
    const submit = vi.fn();
    const result = await withClientValidation(submit)(undefined, formDataOf({ ...VALID, company: "" }));
    expect(submit).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "invalid", errors: { company: expect.any(String) } });
  });

  it("delegates valid input to submit", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "error", values: VALID });
    const data = formDataOf(VALID);
    expect(await withClientValidation(submit)(undefined, data)).toEqual({ status: "error", values: VALID });
    expect(submit).toHaveBeenCalledWith(undefined, data);
  });

  it("keeps the input as a save failure when the call itself rejects (connection dropped)", async () => {
    const submit = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await withClientValidation(submit)(undefined, formDataOf(VALID))).toEqual({ status: "error", values: VALID });
  });

  it("rethrows the redirect that follows a successful save instead of showing a save failure", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/applications;307;" });
    const submit = vi.fn().mockRejectedValue(redirectError);
    await expect(withClientValidation(submit)(undefined, formDataOf(VALID))).rejects.toBe(redirectError);
  });
});

describe("buildNewApplicationDefaults", () => {
  const now = () => new Date("2026-11-19T23:30:00Z");

  it("uses the profile time zone for today", async () => {
    const result = await buildNewApplicationDefaults({
      timeZoneReader: { getTimeZone: async () => "Asia/Tokyo" },
      now,
      newId: () => "id-1",
    });
    expect(result).toEqual({ today: "2026-11-20", clientId: "id-1" });
  });

  it("falls back to the default zone without a reader", async () => {
    const result = await buildNewApplicationDefaults({ timeZoneReader: null, now, newId: () => "id-2" });
    expect(DEFAULT_TIME_ZONE).toBe("Europe/Stockholm");
    expect(result.today).toBe("2026-11-20");
  });
});
