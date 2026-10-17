import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClientMock, signOutMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));
import { GET } from "@/app/api/auth/session-expired/route";

const request = (next: string) =>
  new Request(`http://localhost:3000/api/auth/session-expired?next=${next}`);

describe("GET /api/auth/session-expired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue({ error: null });
    createServerSupabaseClientMock.mockResolvedValue({
      auth: { signOut: signOutMock },
    });
  });

  it("signs out the current session before redirecting to login with a safe next", async () => {
    const response = await GET(request("%2Fdashboard%3Ftab%3Drecent"));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fdashboard%3Ftab%3Drecent",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("redirects and logs safe provider details when cleanup returns an error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    signOutMock.mockResolvedValue({
      error: { code: "provider_down", status: 503, message: "secret" },
    });

    const response = await GET(request("%2Fdashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(error).toHaveBeenCalledWith(
      "auth.expired_session.provider_error",
      { code: "provider_down", status: 503 },
    );
    expect(error.mock.calls[0]?.[1]).not.toBeInstanceOf(Error);
    error.mockRestore();
  });

  it("redirects and logs an unexpected failure when client creation throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createServerSupabaseClientMock.mockRejectedValue(new Error("secret"));

    const response = await GET(request("%2Fdashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(error).toHaveBeenCalledWith(
      "auth.expired_session.unexpected_error",
      {},
    );
    expect(error.mock.calls.flat()).not.toContainEqual(expect.any(Error));
    error.mockRestore();
  });

  it("redirects when cleanup times out", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createServerSupabaseClientMock.mockReturnValue(new Promise(() => undefined));

    try {
      const responsePromise = GET(request("%2Fdashboard"));
      await vi.advanceTimersByTimeAsync(5_000);
      const response = await responsePromise;

      expect(response.status).toBe(307);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(error).toHaveBeenCalledWith(
        "auth.expired_session.unexpected_error",
        {},
      );
    } finally {
      error.mockRestore();
      vi.useRealTimers();
    }
  });

  it("rejects an external next value", async () => {
    const response = await GET(request("https%3A%2F%2Fevil.com"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fdashboard",
    );
  });
});
