import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function pageFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? pageFiles(path) : path.endsWith("/page.tsx") ? [path] : [];
  });
}

describe("protected page guard coverage", () => {
  it("requires every protected page to call requireSession", () => {
    const root = join(process.cwd(), "app", "(protected)");
    for (const file of pageFiles(root)) expect(readFileSync(file, "utf8"), file).toContain("requireSession");
  });
});
