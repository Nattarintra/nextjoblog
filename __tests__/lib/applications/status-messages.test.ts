import { describe, expect, it } from "vitest";

import { APPLICATION_MESSAGES, EXAMPLE_POSTING_URL } from "@/lib/applications/messages";
import { INITIAL_APPLICATION_STATUS, STATUS_DISPLAY } from "@/lib/applications/status";
import { APPLICATION_STATUSES } from "@/lib/applications/types";

describe("STATUS_DISPLAY", () => {
  it.each(APPLICATION_STATUSES)("has a label for %s", (status) => {
    expect(STATUS_DISPLAY[status].label).not.toBe("");
  });

  it("starts new applications as Applied", () => {
    expect(INITIAL_APPLICATION_STATUS).toBe("applied");
    expect(STATUS_DISPLAY[INITIAL_APPLICATION_STATUS].label).toBe("Applied");
  });
});

describe("APPLICATION_MESSAGES", () => {
  it("shows an https example in the invalid link message", () => {
    expect(APPLICATION_MESSAGES.invalidUrl).toContain("https://");
    expect(APPLICATION_MESSAGES.invalidUrl).toContain(EXAMPLE_POSTING_URL);
  });

  it("pluralises the summary heading", () => {
    expect(APPLICATION_MESSAGES.summaryHeading(1)).toBe("1 field needs attention before saving");
    expect(APPLICATION_MESSAGES.summaryHeading(2)).toBe("2 fields need attention before saving");
  });
});
