import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import { applyProtectedCacheControl } from "@/lib/auth/protected-cache";

describe("applyProtectedCacheControl", () => {
  it("sets no-store on protected paths", () => {
    const response = applyProtectedCacheControl(NextResponse.next(), "/dashboard");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it.each(["/login", "/signup", "/api/auth/logout"])("leaves %s untouched", (path) => {
    const response = applyProtectedCacheControl(NextResponse.next(), path);
    expect(response.headers.get("cache-control")).toBeNull();
  });
});
