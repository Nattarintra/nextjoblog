import { describe, expect, it } from "vitest";

import { formatDisplayDate, isoToLocalDate, isValidIsoDate, localDateToIso, todayInTimeZone } from "@/lib/applications/dates";

describe("isValidIsoDate", () => {
  it.each([
    ["2026-11-19", true],
    ["2024-02-29", true],
    ["2026-02-30", false],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["2026-11-1", false],
    ["19-11-2026", false],
    ["", false],
    ["not a date", false],
  ])("%s -> %s", (value, expected) => {
    expect(isValidIsoDate(value)).toBe(expected);
  });
});

describe("todayInTimeZone", () => {
  it.each([
    ["2026-11-19T23:30:00Z", "Europe/Stockholm", "2026-11-20"],
    ["2026-11-19T23:30:00Z", "UTC", "2026-11-19"],
    ["2026-11-20T03:00:00Z", "America/Los_Angeles", "2026-11-19"],
    ["2026-11-19T23:30:00Z", "Asia/Tokyo", "2026-11-20"],
    // DST: Stockholm is UTC+1 before and UTC+2 after the 2026-03-29 switch.
    ["2026-03-28T22:30:00Z", "Europe/Stockholm", "2026-03-28"],
    ["2026-03-28T23:00:00Z", "Europe/Stockholm", "2026-03-29"],
    ["2026-03-29T21:30:00Z", "Europe/Stockholm", "2026-03-29"],
    ["2026-03-29T22:00:00Z", "Europe/Stockholm", "2026-03-30"],
  ])("%s in %s -> %s", (instant, timeZone, expected) => {
    expect(todayInTimeZone(new Date(instant), timeZone)).toBe(expected);
  });
});

describe("formatDisplayDate", () => {
  it("formats a valid date", () => {
    expect(formatDisplayDate("2026-11-17")).toBe("17 Nov 2026");
  });

  it("returns invalid input unchanged", () => {
    expect(formatDisplayDate("2026-02-30")).toBe("2026-02-30");
  });
});

describe("isoToLocalDate / localDateToIso", () => {
  it("round-trips a valid ISO date without a time-zone shift", () => {
    const date = isoToLocalDate("2026-03-01");
    expect(date?.getDate()).toBe(1);
    expect(date?.getMonth()).toBe(2);
    expect(localDateToIso(date!)).toBe("2026-03-01");
  });

  it("returns undefined for invalid input", () => {
    expect(isoToLocalDate("2026-02-30")).toBeUndefined();
    expect(isoToLocalDate("")).toBeUndefined();
  });

  it("pads short years, months and days", () => {
    expect(localDateToIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
