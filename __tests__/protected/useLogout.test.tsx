import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock, pushMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

import { useLogout } from "@/app/(protected)/_components/useLogout";
import { OFFLINE_ERROR_MESSAGE } from "@/lib/auth/messages";
import type { LogoutState } from "@/lib/auth/logout";

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

const failure: LogoutState = { error: "still_signed_in", message: "still in" };

describe("useLogout", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
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

  it("navigates with replace to the logged-out login URL, never push", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useLogout(action));

    await act(async () => { await result.current.logout(); });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?loggedOut=1"));
    expect(pushMock).not.toHaveBeenCalled();
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
});
