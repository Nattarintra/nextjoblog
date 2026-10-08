// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";

import { createAuthRedirect } from "@/lib/auth/redirect-response";

describe("createAuthRedirect", () => {
  it("redirects with a 307, no-store caching, and source cookies", () => {
    const source = NextResponse.next();
    source.cookies.set("refreshed", "token", { httpOnly: true, path: "/" });
    source.cookies.delete("expired");

    const response = createAuthRedirect(
      "/login?next=%2Fdashboard",
      "https://example.test/dashboard",
      source,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.test/login?next=%2Fdashboard",
    );
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.cookies.get("refreshed")?.value).toBe("token");
    expect(response.headers.get("set-cookie")).toContain("expired=");
  });
});
