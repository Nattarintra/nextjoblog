import { describe, expect, it } from "vitest";

import { deriveAccountInitial } from "@/app/(protected)/_components/account-initial";

describe("deriveAccountInitial", () => {
  it.each([
    ["natta@example.com", "N"],
    ["  zed@example.com", "Z"],
    ["émile@example.com", "É"],
    [undefined, "?"],
    ["", "?"],
    ["1abc@example.com", "?"],
  ])("derives %s -> %s", (email, expected) => {
    expect(deriveAccountInitial(email)).toBe(expected);
  });
});
