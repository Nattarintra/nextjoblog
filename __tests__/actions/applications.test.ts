import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  redirect: vi.fn(),
  insert: vi.fn(),
  logApplicationEvent: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/applications/repository", () => ({
  createApplicationWriter: () => ({ insert: mocks.insert }),
}));
vi.mock("@/lib/applications/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/applications/log")>()),
  logApplicationEvent: mocks.logApplicationEvent,
}));

import { logApplicationAction } from "@/app/actions/applications";
import { APPLICATIONS_PATH } from "@/lib/applications/paths";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

function formData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    title: "Dev",
    company: "Acme",
    applied_date: "2026-11-19",
    location: "Stockholm",
    posting_url: "https://acme.test/1",
    client_id: CLIENT_ID,
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("logApplicationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ status: "authenticated", claims: { sub: "user-1" } });
    mocks.createServerSupabaseClient.mockResolvedValue({});
    mocks.insert.mockResolvedValue("inserted");
  });

  it("saves with the session user, ignoring posted status and user_id, then redirects", async () => {
    await logApplicationAction(undefined, formData({ status: "offer_received", user_id: "attacker" }));
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: CLIENT_ID, user_id: "user-1", status: "applied" }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith(APPLICATIONS_PATH);
  });

  it("returns field errors and does not redirect for invalid input", async () => {
    const state = await logApplicationAction(undefined, formData({ title: "", posting_url: "linkedin job" }));
    expect(state?.status).toBe("invalid");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns the error state with the input when saving fails", async () => {
    mocks.insert.mockRejectedValue(new Error("down"));
    const state = await logApplicationAction(undefined, formData());
    expect(state).toMatchObject({ status: "error", values: { title: "Dev" } });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps the input when the session check fails", async () => {
    mocks.requireSession.mockResolvedValue({ status: "verification_failed", loginHref: "/login" });
    const state = await logApplicationAction(undefined, formData());
    expect(state).toMatchObject({ status: "error", values: { company: "Acme" } });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("lets the expired-session redirect propagate", async () => {
    mocks.requireSession.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(logApplicationAction(undefined, formData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns an error state when the session has no user id", async () => {
    mocks.requireSession.mockResolvedValue({ status: "authenticated", claims: {} });
    const state = await logApplicationAction(undefined, formData());
    expect(state?.status).toBe("error");
    expect(mocks.logApplicationEvent).toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("generates an id when the posted client id is malformed", async () => {
    await logApplicationAction(undefined, formData({ client_id: "not-a-uuid" }));
    const record = mocks.insert.mock.calls[0][0];
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.id).not.toBe("not-a-uuid");
  });
});
