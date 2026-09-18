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

  it("clears only the current session before redirecting to login", async () => {
    const response = await GET(new Request("http://localhost:3000/api/auth/session-expired"));

    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
