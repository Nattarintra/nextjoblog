import { afterEach, describe, expect, it, vi } from "vitest";

import { logApplicationEvent } from "@/lib/applications/log";

describe("logApplicationEvent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the event with details, defaulting to an empty object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logApplicationEvent("e", { code: "1" });
    logApplicationEvent("e2");
    expect(spy).toHaveBeenNthCalledWith(1, "e", { code: "1" });
    expect(spy).toHaveBeenNthCalledWith(2, "e2", {});
  });
});
