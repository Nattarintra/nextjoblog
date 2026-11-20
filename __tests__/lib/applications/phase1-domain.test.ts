import { describe, expect, it } from "vitest";

import { isClosingBeforeApplied } from "@/lib/applications/closing-date";
import { CHOICE_FIELDS, emptyJobDetails, findChoiceLabel, isChoiceValue } from "@/lib/applications/job-details";
import { MAX_TAG_COUNT, MAX_TAG_LENGTH } from "@/lib/applications/limits";
import { APPLICATION_MESSAGES, APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { applicationDetailPath } from "@/lib/applications/paths";
import { addTag, normalizeTag, normalizeTags, removeTag } from "@/lib/applications/tech-tags";
import { isUuid } from "@/lib/applications/uuid";

describe("closing date rules", () => {
  it.each([
    ["2026-08-25", "2026-08-20", true],
    ["2026-08-25", "2026-08-25", false],
    ["2026-08-25", "2026-08-26", false],
    ["", "2026-08-20", false],
    ["2026-08-25", "2026-02-30", false],
  ])("compares %s and %s", (applied, closing, expected) => {
    expect(isClosingBeforeApplied(applied, closing)).toBe(expected);
  });
});

describe("technology tags", () => {
  const rejectionReason = (raw: string, tags: readonly string[] = []) => {
    const result = addTag(tags, raw);
    if (result.status !== "rejected") throw new Error("expected rejected tag");
    return result.reason;
  };
  it("normalizes Unicode and whitespace", () => expect(normalizeTag("  Cafe\u0301  ")).toBe("Café"));
  it("deduplicates case-insensitively and keeps the first spelling", () => {
    expect(addTag(["React"], " react ")).toEqual({ status: "rejected", reason: "duplicate" });
    expect(normalizeTags(["React", " react ", "TypeScript"])).toEqual(["React", "TypeScript"]);
  });
  it("rejects empty, long and over-limit tags", () => {
    expect(rejectionReason(" ")).toBe("empty");
    expect(rejectionReason("x".repeat(MAX_TAG_LENGTH + 1))).toBe("too_long");
    expect(rejectionReason("extra", Array.from({ length: MAX_TAG_COUNT }, (_, i) => `Tag ${i}`))).toBe("too_many");
  });
  it("removes a tag case-insensitively", () => expect(removeTag(["React", "TypeScript"], "react")).toEqual(["TypeScript"]));
});

describe("job detail tables and paths", () => {
  it("contains the prescribed choices and shared labels", () => {
    expect(findChoiceLabel("contract_type", "contract")).toBe("Fixed-term");
    expect(isChoiceValue("discipline", "tester_qa")).toBe(true);
    expect(isChoiceValue("work_format", "onsite")).toBe(false);
    expect(CHOICE_FIELDS).toHaveLength(3);
    expect(emptyJobDetails()).toEqual({ closing_date: "", salary_info: "", work_format: "", contract_type: "", discipline: "", tech_stack: [] });
  });
  it("keeps new copy in the application message tables", () => {
    expect(APPLICATION_MESSAGES.invalidChoice("Track")).toContain("track");
    expect(APPLICATION_MESSAGES.tooManyTags(MAX_TAG_COUNT)).toContain(String(MAX_TAG_COUNT));
    expect(APPLICATION_MESSAGES.tagTooLong(MAX_TAG_LENGTH)).toContain(String(MAX_TAG_LENGTH));
    expect(APPLICATION_PAGE_MESSAGES.removeTagLabel("React")).toBe("Remove React");
    expect(APPLICATION_PAGE_MESSAGES.clearChoiceLabel("Track")).toBe("Clear track");
    expect(APPLICATION_PAGE_MESSAGES.tagAddedAnnouncement("React")).toBe("React added");
    expect(APPLICATION_PAGE_MESSAGES.tagRemovedAnnouncement("React")).toBe("React removed");
    expect(APPLICATION_PAGE_MESSAGES.postingLinkLabel("Dev", "Acme")).toContain("Dev at Acme");
  });
  it("builds the detail URL and validates UUIDs", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(applicationDetailPath(id)).toBe(`/applications/${id}`);
    expect(isUuid(id)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});
