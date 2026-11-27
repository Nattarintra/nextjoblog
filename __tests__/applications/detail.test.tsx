import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  get: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  logApplicationEvent: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/applications/repository", () => ({ createApplicationDetailReader: () => ({ get: mocks.get }) }));
vi.mock("@/lib/applications/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/applications/log")>()),
  logApplicationEvent: mocks.logApplicationEvent,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import ApplicationDetailPage from "@/app/(protected)/applications/[id]/page";
import type { ApplicationDetail } from "@/lib/applications/types";

const SESSION = { status: "authenticated", claims: { sub: "user-1" } };
const id = "11111111-1111-4111-8111-111111111111";
const detail: ApplicationDetail = {
  id, user_id: "user-1", title: "Frontend Engineer", company: "Acme", applied_date: "2026-11-17",
  location: "Remote", posting_url: "https://acme.test/job", status: "applied", closing_date: null,
  salary_info: "48,000 SEK/month", work_format: "remote", contract_type: null, discipline: "frontend", tech_stack: ["React"],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue(SESSION);
  mocks.createServerSupabaseClient.mockResolvedValue({});
});
afterEach(cleanup);

describe("ApplicationDetailPage", () => {
  it("renders the hero, chips, details and safe posting link", async () => {
    mocks.get.mockResolvedValue(detail);
    render(await ApplicationDetailPage({ params: Promise.resolve({ id }) }));
    expect(screen.getByRole("heading", { name: "Application details" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Frontend Engineer" })).toBeTruthy();
    expect(screen.getAllByText("Remote").length).toBe(2);
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBe(2);
    expect(screen.getByRole("link", { name: /open job posting/i }).getAttribute("href")).toBe(detail.posting_url);
  });

  it("renders every Story 1.4 detail field with accessible optional fallbacks", async () => {
    mocks.get.mockResolvedValue({
      ...detail,
      closing_date: "2026-11-30",
      contract_type: null,
      salary_info: "48,000 SEK/month",
      work_format: "remote",
      discipline: "frontend",
      tech_stack: ["React", "TypeScript"],
    });
    render(await ApplicationDetailPage({ params: Promise.resolve({ id }) }));

    expect(screen.getByText("30 Nov 2026")).toBeTruthy();
    expect(screen.getByText("48,000 SEK/month")).toBeTruthy();
    expect(screen.getByText("Frontend")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.getByText("Not provided")).toBeTruthy();
  });

  it("renders not found for malformed and missing ids", async () => {
    await expect(ApplicationDetailPage({ params: Promise.resolve({ id: "bad" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.get.mockResolvedValue(null);
    await expect(ApplicationDetailPage({ params: Promise.resolve({ id }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a load alert and logs safe details", async () => {
    mocks.get.mockRejectedValue({ code: "XX000", message: "private" });
    render(await ApplicationDetailPage({ params: Promise.resolve({ id }) }));
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't load/i);
    expect(mocks.logApplicationEvent).toHaveBeenCalledWith("applications.log.detail_failed", { code: "XX000" });
  });

  it("does not render an unsafe posting URL", async () => {
    mocks.get.mockResolvedValue({ ...detail, posting_url: "javascript:alert(1)" });
    render(await ApplicationDetailPage({ params: Promise.resolve({ id }) }));
    expect(screen.queryByRole("link", { name: /open job posting/i })).toBeNull();
  });

  it("renders the session verification screen", async () => {
    mocks.requireSession.mockResolvedValue({ status: "verification_failed", loginHref: "/login" });
    expect((await ApplicationDetailPage({ params: Promise.resolve({ id }) })).type.name).toBe("SessionCheckFailed");
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
