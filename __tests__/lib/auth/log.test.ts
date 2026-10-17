import { describe, expect, it, vi } from "vitest";

import { logAuthEvent } from "@/lib/auth/log";

describe("logAuthEvent", () => {
  it("logs an empty details object by default", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAuthEvent("auth.test.event");

    expect(error).toHaveBeenCalledWith("auth.test.event", {});
    error.mockRestore();
  });

  it("passes safe details through unchanged", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAuthEvent("auth.test.event", { code: "provider_error", status: 503 });

    expect(error).toHaveBeenCalledWith("auth.test.event", {
      code: "provider_error",
      status: 503,
    });
    error.mockRestore();
  });
});
