import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

import { useLogout } from "@/app/(protected)/_components/useLogout";
import { OFFLINE_ERROR_MESSAGE } from "@/lib/auth/messages";
import { LOGOUT_FAILURES } from "@/lib/auth/logout-state";
import type { LogoutState } from "@/lib/auth/logout-state";
import { LOGOUT_API_PATH } from "@/lib/auth/paths";

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

const failure: LogoutState = { error: "still_signed_in", message: "still in" };

describe("useLogout", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.stubGlobal("location", { replace: replaceMock });
    setOnline(true);
  });

  it("goes idle → error and allows retry that re-invokes the action", async () => {
    const action = vi.fn().mockResolvedValueOnce(failure).mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useLogout(action));

    expect(result.current.errorMessage).toBeNull();
    await act(async () => { await result.current.logout(); });
    await waitFor(() => expect(result.current.errorMessage).toBe("still in"));
    expect(replaceMock).not.toHaveBeenCalled();

    await act(async () => { await result.current.logout(); });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("hard-navigates with location.replace to the logged-out login URL", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useLogout(action));

    await act(async () => { await result.current.logout(); });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?loggedOut=1"));
  });

  it("stays pending after success until navigation and ignores further calls", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useLogout(action));

    await act(async () => { await result.current.logout(); });
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(result.current.isPending).toBe(true);

    await act(async () => { await result.current.logout(); });
    expect(action).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a second call while the first is pending", async () => {
    let resolve!: (state: LogoutState) => void;
    const action = vi.fn().mockReturnValue(new Promise<LogoutState>((r) => (resolve = r)));
    const { result } = renderHook(() => useLogout(action));

    await act(async () => {
      void result.current.logout();
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => { await result.current.logout(); });
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => resolve(failure));
  });

  it("does not dispatch while offline and recovers when back online", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useLogout(action));

    setOnline(false);
    await act(async () => { await result.current.logout(); });
    expect(action).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe(OFFLINE_ERROR_MESSAGE);

    setOnline(true);
    await act(async () => { await result.current.logout(); });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(result.current.errorMessage).toBeNull();
  });

  describe("default fetch request", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    async function runLogout() {
      const { result } = renderHook(() => useLogout());
      await act(async () => { await result.current.logout(); });
      return result;
    }

    it("POSTs to the logout route and navigates on { ok: true }", async () => {
      fetchMock.mockResolvedValue(Response.json({ ok: true }));
      await runLogout();

      expect(fetchMock).toHaveBeenCalledWith(LOGOUT_API_PATH, { method: "POST", credentials: "same-origin" });
      await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    });

    it("surfaces the server failure message without navigating", async () => {
      fetchMock.mockResolvedValue(Response.json(failure));
      const result = await runLogout();

      expect(result.current.errorMessage).toBe("still in");
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it.each([
      ["a null body", () => Response.json(null)],
      ["a non-OK response", () => new Response("boom", { status: 500 })],
    ])("falls back to the unknown failure on %s", async (_label, makeResponse) => {
      fetchMock.mockResolvedValue(makeResponse());
      const result = await runLogout();

      expect(result.current.errorMessage).toBe(LOGOUT_FAILURES.unknown.message);
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("falls back to the unknown failure when fetch throws", async () => {
      fetchMock.mockRejectedValue(new TypeError("network"));
      const result = await runLogout();

      expect(result.current.errorMessage).toBe(LOGOUT_FAILURES.unknown.message);
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });
});
