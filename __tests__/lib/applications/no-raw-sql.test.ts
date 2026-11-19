import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB_DIR = join(process.cwd(), "lib/applications");
const ACTION_FILE = join(process.cwd(), "app/actions/applications.ts");

const FORBIDDEN: Array<[string, RegExp]> = [
  ["rpc call", /\.rpc\(/],
  ["or() filter string", /\.or\(/],
  ["interpolated SQL template", /`[^`]*\b(select|insert|update|delete|from|where)\b[^`]*\$\{/i],
];

const featureFiles = [
  ...readdirSync(LIB_DIR).filter((name) => name.endsWith(".ts")).map((name) => join(LIB_DIR, name)),
  ACTION_FILE,
];

describe("applications feature files", () => {
  it.each(featureFiles)("%s builds no raw SQL or string filters", (file) => {
    const source = readFileSync(file, "utf8");
    for (const [, pattern] of FORBIDDEN) expect(source).not.toMatch(pattern);
  });
});
