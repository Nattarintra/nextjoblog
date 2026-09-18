import { describe, expect, it } from "vitest";

import { getNoticeState } from "@/app/dashboard/session-expiry-notice";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_EXPIRY = 30 * DAY_MS;

describe("getNoticeState", () => {
  it("does not show before the notice window", () => {
    expect(getNoticeState(27 * DAY_MS, SESSION_EXPIRY, false)).toBe(false);
  });

  it("shows at the start of the notice window", () => {
    expect(getNoticeState(28 * DAY_MS, SESSION_EXPIRY, false)).toBe(true);
  });

  it("shows throughout the notice window when unanswered", () => {
    expect(getNoticeState(29 * DAY_MS, SESSION_EXPIRY, false)).toBe(true);
  });

  it("does not show after the cycle has been answered", () => {
    expect(getNoticeState(28 * DAY_MS, SESSION_EXPIRY, true)).toBe(false);
    expect(getNoticeState(29.5 * DAY_MS, SESSION_EXPIRY, true)).toBe(false);
  });

  it("leaves expiry enforcement to the caller after the cycle expires", () => {
    expect(getNoticeState(31 * DAY_MS, SESSION_EXPIRY, false)).toBe(true);
  });
});
