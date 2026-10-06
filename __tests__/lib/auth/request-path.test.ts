import { describe, expect, it, vi } from "vitest";

const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }));

vi.mock("next/headers", () => ({ headers: headersMock }));

import { getRequestPath, REQUEST_PATH_HEADER } from "@/lib/auth/request-path";

describe("getRequestPath", () => {
  it("reads the proxy header and returns undefined when absent", async () => {
    headersMock.mockResolvedValue({ get: (name: string) => name === REQUEST_PATH_HEADER ? "/dashboard?tab=recent" : null });
    await expect(getRequestPath()).resolves.toBe("/dashboard?tab=recent");

    headersMock.mockResolvedValue({ get: () => null });
    await expect(getRequestPath()).resolves.toBeUndefined();
  });
});
