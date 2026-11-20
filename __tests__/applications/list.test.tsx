import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  list: vi.fn(),
  getTimeZone: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  logApplicationEvent: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/applications/repository", () => ({
  createApplicationReader: () => ({ list: mocks.list }),
  createProfileTimeZoneReader: () => ({ getTimeZone: mocks.getTimeZone }),
}));
vi.mock("@/lib/applications/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/applications/log")>()),
  logApplicationEvent: mocks.logApplicationEvent,
}));
vi.mock("@/app/actions/applications", () => ({ logApplicationAction: vi.fn() }));

import ApplicationsPage from "@/app/(protected)/applications/page";
import NewApplicationPage from "@/app/(protected)/applications/new/page";
import { ApplicationRow } from "@/app/(protected)/applications/_components/ApplicationRow";
import { LIST_PAGE_SIZE } from "@/lib/applications/limits";
import type { ApplicationSummary } from "@/lib/applications/types";

const SESSION = { status: "authenticated", claims: { sub: "user-1" } };
const FAILED = { status: "verification_failed", loginHref: "/login?next=%2Fapplications" };

function application(overrides: Partial<ApplicationSummary> = {}): ApplicationSummary {
  return {
    id: "a1",
    title: "Frontend Engineer",
    company: "Spotify",
    location: "Remote",
    applied_date: "2026-11-17",
    posting_url: "https://jobs.spotify.com/1",
    status: "applied",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue(SESSION);
  mocks.createServerSupabaseClient.mockResolvedValue({});
});
afterEach(cleanup);

describe("ApplicationsPage", () => {
  it("lists applications in the order the reader returns them, with Applied badges", async () => {
    mocks.list.mockResolvedValue([application({ id: "a1", title: "Newest" }), application({ id: "a2", title: "Older", applied_date: "2026-11-01" })]);
    render(await ApplicationsPage());
    const items = within(screen.getByRole("list", { name: /applications/i })).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByText(/Newest|Older/).textContent)).toEqual(["Newest", "Older"]);
    expect(within(items[0]).getByText("Applied")).toBeTruthy();
    expect(within(items[0]).getByText(/Applied 17 Nov 2026/)).toBeTruthy();
  });

  it("tells the user the list is capped only when the cap is reached", async () => {
    mocks.list.mockResolvedValue(Array.from({ length: LIST_PAGE_SIZE }, (_, index) => application({ id: `a${index}` })));
    const { unmount } = render(await ApplicationsPage());
    expect(screen.getByText(`Showing your ${LIST_PAGE_SIZE} most recent applications.`)).toBeTruthy();
    unmount();

    mocks.list.mockResolvedValue([application()]);
    render(await ApplicationsPage());
    expect(screen.queryByText(/most recent applications/)).toBeNull();
  });

  it("shows the empty state with an Add action", async () => {
    mocks.list.mockResolvedValue([]);
    render(await ApplicationsPage());
    expect(screen.getByRole("heading", { name: /no applications yet/i })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /add application/i }).every((a) => a.getAttribute("href") === "/applications/new")).toBe(true);
  });

  it("shows a load error and logs when the reader fails", async () => {
    mocks.list.mockRejectedValue(new Error("boom"));
    render(await ApplicationsPage());
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't load/i);
    expect(mocks.logApplicationEvent).toHaveBeenCalled();
  });

  it("renders the session failure screen", async () => {
    mocks.requireSession.mockResolvedValue(FAILED);
    expect((await ApplicationsPage()).type.name).toBe("SessionCheckFailed");
  });
});

describe("ApplicationRow", () => {
  it("renders a safe posting link opening safely in a new tab", () => {
    render(<ul><ApplicationRow application={application()} /></ul>);
    const link = screen.getByRole("link", { name: /job posting for frontend engineer at spotify/i });
    expect(link.getAttribute("href")).toBe("https://jobs.spotify.com/1");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("never renders an unsafe href", () => {
    render(<ul><ApplicationRow application={application({ posting_url: "javascript:alert(1)" })} /></ul>);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("NewApplicationPage", () => {
  it("renders the form with today in the user's time zone", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T23:30:00Z"));
    mocks.getTimeZone.mockResolvedValue("Asia/Tokyo");
    const page = await NewApplicationPage();
    vi.useRealTimers();
    const form = page.props.children;
    expect(form.props.today).toBe("2026-11-20");
    expect(form.props.initialValues.applied_date).toBe("2026-11-20");
    expect(form.props.clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("falls back to the default zone when the session has no user id", async () => {
    mocks.requireSession.mockResolvedValue({ status: "authenticated", claims: {} });
    const page = await NewApplicationPage();
    expect(mocks.getTimeZone).not.toHaveBeenCalled();
    expect(page.props.children.props.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("renders the session failure screen", async () => {
    mocks.requireSession.mockResolvedValue(FAILED);
    expect((await NewApplicationPage()).type.name).toBe("SessionCheckFailed");
  });
});
