import { describe, expect, it } from "vitest";

import { DEFAULT_TIME_ZONE } from "@/lib/applications/limits";
import { getUserTimeZone, isValidTimeZone } from "@/lib/applications/time-zone";

describe("isValidTimeZone", () => {
  it.each([
    ["Europe/Stockholm", true],
    ["UTC", true],
    ["Not/AZone", false],
    ["", false],
  ])("%j -> %s", (zone, expected) => {
    expect(isValidTimeZone(zone)).toBe(expected);
  });
});

describe("getUserTimeZone", () => {
  const readerReturning = (value: string | null) => ({ getTimeZone: async () => value });

  it("returns the profile zone when valid", async () => {
    expect(await getUserTimeZone(readerReturning("Asia/Tokyo"))).toBe("Asia/Tokyo");
  });

  it.each([
    ["null (missing profile row)", null],
    ["empty string", ""],
    ["invalid zone", "Not/AZone"],
  ])("falls back for %s", async (_label, value) => {
    expect(await getUserTimeZone(readerReturning(value))).toBe(DEFAULT_TIME_ZONE);
  });

  it("falls back when the reader throws", async () => {
    const reader = {
      getTimeZone: async () => {
        throw new Error("db down");
      },
    };
    expect(await getUserTimeZone(reader)).toBe(DEFAULT_TIME_ZONE);
  });
});
