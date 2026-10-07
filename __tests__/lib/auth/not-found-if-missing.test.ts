import { describe, expect, it, vi } from "vitest";
import { notFoundIfMissing } from "@/lib/auth/not-found-if-missing";

describe("notFoundIfMissing", () => {
  it.each([null, undefined])("calls notFound for %s", (row) => {
    const notFound = vi.fn((): never => { throw new Error("not found"); });
    expect(() => notFoundIfMissing(row, notFound)).toThrow("not found");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("returns an existing row", () => {
    const row = { id: "application" };
    expect(notFoundIfMissing(row, vi.fn((): never => { throw new Error("unexpected"); }))).toBe(row);
  });
});
