import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClientMock, signOutMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { GET } from "@/app/api/auth/session-expired/route";

describe("GET /api/auth/session-expired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue({ error: null });
    createServerSupabaseClientMock.mockResolvedValue({
      auth: { signOut: signOutMock },
    });
  });

  it("fully signs out the session before redirecting to login with a safe next", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/auth/session-expired?next=%2Fdashboard%3Ftab%3Drecent"),
    );

    expect(signOutMock).toHaveBeenCalledWith();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fdashboard%3Ftab%3Drecent",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("rejects an external next value", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/auth/session-expired?next=https%3A%2F%2Fevil.com"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fdashboard",
    );
  });
});
