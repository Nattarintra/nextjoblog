import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB_DIR = join(process.cwd(), "lib/applications");
const ACTION_FILE = join(process.cwd(), "app/actions/applications.ts");
const ROUTE_DIR = join(process.cwd(), "app/(protected)/applications");

const FORBIDDEN: Array<[string, RegExp]> = [
  ["rpc call", /\.rpc\(/],
  ["or() filter string", /\.or\(/],
  ["interpolated SQL template", /`[^`]*\b(select|insert|update|delete|from|where)\b[^`]*\$\{/i],
];

function sourceFilesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesIn(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const featureFiles = [...sourceFilesIn(LIB_DIR), ...sourceFilesIn(ROUTE_DIR), ACTION_FILE];

describe("applications feature files", () => {
  it.each(featureFiles)("%s builds no raw SQL or string filters", (file) => {
    const source = readFileSync(file, "utf8");
    for (const [, pattern] of FORBIDDEN) expect(source).not.toMatch(pattern);
  });
});
