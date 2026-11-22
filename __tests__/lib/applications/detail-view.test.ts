import { describe, expect, it } from "vitest";

import { buildJobDetailRows, heroChips } from "@/lib/applications/detail-view";
import type { ApplicationDetail } from "@/lib/applications/types";

const detail: ApplicationDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  title: "Frontend Engineer",
  company: "Acme",
  applied_date: "2026-11-17",
  location: "Remote",
  posting_url: "https://acme.test/job",
  status: "interview_scheduled",
  closing_date: "2026-11-30",
  salary_info: "48,000 SEK/month",
  work_format: "remote",
  contract_type: "contract",
  discipline: "frontend",
  tech_stack: ["React", "TypeScript"],
};

describe("buildJobDetailRows", () => {
  it("formats dates, resolves choice labels and keeps tags", () => {
    expect(buildJobDetailRows(detail)).toEqual([
      { key: "closing_date", label: "Closing date", kind: "text", value: "30 Nov 2026" },
      { key: "work_format", label: "Work arrangement", kind: "text", value: "Remote" },
      { key: "contract_type", label: "Contract type", kind: "text", value: "Fixed-term" },
      { key: "discipline", label: "Track", kind: "text", value: "Frontend" },
      { key: "tech_stack", label: "Technologies", kind: "tags", value: ["React", "TypeScript"] },
      { key: "salary_info", label: "Salary", kind: "text", value: "48,000 SEK/month" },
    ]);
  });

  it("turns unset optional values into null", () => {
    const rows = buildJobDetailRows({ ...detail, closing_date: null, work_format: null, tech_stack: [], salary_info: "" });
    expect(rows.map(({ value }) => value)).toEqual([null, null, "Fixed-term", "Frontend", null, null]);
  });
});

describe("heroChips", () => {
  it("includes the work arrangement when set and always includes applied date", () => {
    expect(heroChips(detail)).toEqual(["Remote", "Applied 17 Nov 2026"]);
    expect(heroChips({ ...detail, work_format: null })).toEqual(["Applied 17 Nov 2026"]);
  });
});
