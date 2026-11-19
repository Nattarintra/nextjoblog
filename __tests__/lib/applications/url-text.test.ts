import { describe, expect, it } from "vitest";

import { hasControlCharacters, normalizeText } from "@/lib/applications/text";
import { isSafeHttpUrl } from "@/lib/applications/url";

describe("isSafeHttpUrl", () => {
  it.each([
    ["https://jobs.example.com/123", true],
    ["http://example.com", true],
    ["HTTPS://EXAMPLE.COM/x?y=1#z", true],
    ["linkedin job", false],
    ["javascript:alert(1)", false],
    ["data:text/html,<script>1</script>", false],
    ["file:///etc/passwd", false],
    ["ftp://example.com/file", false],
    ["https://", false],
    ["", false],
  ])("%s -> %s", (value, expected) => {
    expect(isSafeHttpUrl(value)).toBe(expected);
  });
});

describe("normalizeText", () => {
  it("trims and applies NFC", () => {
    expect(normalizeText("  é  ")).toBe("é");
  });
});

describe("hasControlCharacters", () => {
  it.each([
    ["plain text", false],
    ["Malmö · Hybrid", false],
    ["a\u0000b", true],
    ["a\nb", true],
    ["a\tb", true],
    ["a\u007Fb", true],
    ["a\u0085b", true],
  ])("%j -> %s", (value, expected) => {
    expect(hasControlCharacters(value)).toBe(expected);
  });
});
