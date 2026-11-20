import { describe, expect, it } from "vitest";

import { MAX_TEXT_LENGTH, MAX_URL_LENGTH } from "@/lib/applications/limits";
import { validateApplicationInput, normalizeApplicationValues } from "@/lib/applications/validation";
import { FIELD_NAMES, type ApplicationFormValues } from "@/lib/applications/types";
import { emptyJobDetails } from "@/lib/applications/job-details";

const VALID: ApplicationFormValues = {
  title: "Frontend Engineer",
  company: "Spotify",
  applied_date: "2026-11-17",
  location: "Remote",
  posting_url: "https://jobs.spotify.com/12345",
  ...emptyJobDetails(),
};

const with_ = (patch: Partial<ApplicationFormValues>): ApplicationFormValues => ({ ...VALID, ...patch });
const urlOfLength = (length: number) => `https://a.co/${"x".repeat(length - "https://a.co/".length)}`;

describe("validateApplicationInput", () => {
  it("accepts valid input", () => {
    expect(validateApplicationInput(VALID)).toEqual({});
  });

  it.each(FIELD_NAMES)("rejects empty and whitespace-only %s", (field) => {
    expect(validateApplicationInput(with_({ [field]: "" }))).toHaveProperty(field);
    expect(validateApplicationInput(with_({ [field]: "   " }))).toHaveProperty(field);
  });

  it("reports all errors in form order", () => {
    const errors = validateApplicationInput({
      ...emptyJobDetails(), title: "", company: "", applied_date: "", location: "", posting_url: "",
    });
    expect(Object.keys(errors)).toEqual([...FIELD_NAMES]);
  });

  it.each(["linkedin job", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://x.com/a"])(
    "rejects posting link %j with an https example",
    (posting_url) => {
      expect(validateApplicationInput(with_({ posting_url })).posting_url).toContain("https://");
    },
  );

  it.each(["2026-02-30", "17 Nov 2026", "2026-13-01"])("rejects date %j", (applied_date) => {
    expect(validateApplicationInput(with_({ applied_date }))).toHaveProperty("applied_date");
  });

  it("accepts a future date", () => {
    expect(validateApplicationInput(with_({ applied_date: "2099-01-01" }))).toEqual({});
  });

  it.each([
    [MAX_TEXT_LENGTH - 1, false],
    [MAX_TEXT_LENGTH, false],
    [MAX_TEXT_LENGTH + 1, true],
  ])("text length %i -> error %s", (length, hasError) => {
    const errors = validateApplicationInput(with_({ title: "a".repeat(length) }));
    expect("title" in errors).toBe(hasError);
  });

  it.each([
    [MAX_URL_LENGTH, false],
    [MAX_URL_LENGTH + 1, true],
  ])("url length %i -> error %s", (length, hasError) => {
    const errors = validateApplicationInput(with_({ posting_url: urlOfLength(length) }));
    expect("posting_url" in errors).toBe(hasError);
    if (hasError) expect(errors.posting_url).toContain(String(MAX_URL_LENGTH));
  });

  it.each(["a\u0000b", "a\nb", "a\u007Fb"])("rejects control characters in %j", (title) => {
    expect(validateApplicationInput(with_({ title }))).toHaveProperty("title");
  });

  it.each(["'; DROP TABLE applications; --", "<script>alert(1)</script>", "Robert'); --"])(
    "accepts benign-for-storage payload %j verbatim",
    (title) => {
      expect(validateApplicationInput(with_({ title }))).toEqual({});
    },
  );
});

describe("normalizeApplicationValues", () => {
  it("trims every field", () => {
    const padded = { ...VALID, ...Object.fromEntries(FIELD_NAMES.map((f) => [f, ` ${VALID[f]} `])) } as ApplicationFormValues;
    expect(normalizeApplicationValues(padded)).toEqual(VALID);
  });
});
