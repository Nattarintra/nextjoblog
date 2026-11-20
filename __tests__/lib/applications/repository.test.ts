import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  ApplicationRepositoryError,
  createApplicationReader,
  createApplicationWriter,
  createProfileTimeZoneReader,
} from "@/lib/applications/repository";
import { LIST_PAGE_SIZE } from "@/lib/applications/limits";
import type { NewApplicationRecord } from "@/lib/applications/types";

type Result = { data?: unknown; error?: { code?: string } | null };

/** Chainable fake of the query builder: every call is recorded, awaiting resolves `result`. */
function fakeClient(results: { insert?: Result; select?: Result }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  const record = (name: string, result?: Result) =>
    vi.fn((...args: unknown[]) => {
      calls.push([name, args]);
      return result ? Promise.resolve({ data: null, error: null, ...result }) : builder;
    });
  builder.select = record("select");
  builder.eq = record("eq");
  builder.order = vi.fn((...args: unknown[]) => {
    calls.push(["order", args]);
    return builder;
  });
  builder.limit = vi.fn((...args: unknown[]) => {
    calls.push(["limit", args]);
    return builder;
  });
  builder.returns = record("returns", results.select);
  builder.maybeSingle = record("maybeSingle", results.select);
  const insert = record("insert", results.insert);
  const from = vi.fn((table: string) => {
    calls.push(["from", [table]]);
    return { ...builder, insert };
  });
  return { client: { from } as unknown as SupabaseClient, calls, insert };
}

const RECORD: NewApplicationRecord = {
  id: "id-1",
  user_id: "user-1",
  title: "Dev",
  company: "Acme",
  applied_date: "2026-11-19",
  location: "Stockholm",
  posting_url: "https://acme.test/1",
  status: "applied",
  closing_date: null,
  salary_info: null,
  work_format: null,
  contract_type: null,
  discipline: null,
  tech_stack: [],
};

describe("createApplicationWriter", () => {
  it("inserts exactly the 8 allow-listed keys and ignores spoofed extras", async () => {
    const { client, insert } = fakeClient({ insert: {} });
    const spoofed = { ...RECORD, status: "applied", created_at: "2000-01-01", role: "admin" } as NewApplicationRecord;
    expect(await createApplicationWriter(client).insert(spoofed)).toBe("inserted");
    const row = insert.mock.calls[0][0] as object;
    expect(Object.keys(row).sort()).toEqual(
      ["applied_date", "company", "id", "location", "posting_url", "status", "title", "user_id"],
    );
  });

  it("returns already_exists when the stored row has identical content", async () => {
    const stored = { title: "Dev", company: "Acme", applied_date: "2026-11-19", location: "Stockholm", posting_url: "https://acme.test/1" };
    const { client, calls } = fakeClient({ insert: { error: { code: "23505" } }, select: { data: stored } });
    expect(await createApplicationWriter(client).insert(RECORD)).toBe("already_exists");
    expect(calls).toContainEqual(["eq", ["user_id", "user-1"]]);
  });

  it("returns id_conflict when the stored content differs", async () => {
    const stored = { title: "Other", company: "Acme", applied_date: "2026-11-19", location: "Stockholm", posting_url: "https://acme.test/1" };
    const { client } = fakeClient({ insert: { error: { code: "23505" } }, select: { data: stored } });
    expect(await createApplicationWriter(client).insert(RECORD)).toBe("id_conflict");
  });

  it("returns id_conflict when the row is not visible to the user", async () => {
    const { client } = fakeClient({ insert: { error: { code: "23505" } }, select: { data: null } });
    expect(await createApplicationWriter(client).insert(RECORD)).toBe("id_conflict");
  });

  it("throws a code-only error for other insert failures", async () => {
    const { client } = fakeClient({ insert: { error: { code: "42501" } } });
    await expect(createApplicationWriter(client).insert(RECORD)).rejects.toMatchObject({ code: "42501" });
  });

  it("throws when the ownership re-select fails", async () => {
    const { client } = fakeClient({ insert: { error: { code: "23505" } }, select: { error: { code: "XX000" } } });
    await expect(createApplicationWriter(client).insert(RECORD)).rejects.toBeInstanceOf(ApplicationRepositoryError);
  });
});

describe("createApplicationReader", () => {
  it("lists newest first by applied date then creation time, selecting list columns only", async () => {
    const rows = [{ id: "a" }];
    const { client, calls } = fakeClient({ select: { data: rows } });
    expect(await createApplicationReader(client).list()).toEqual(rows);
    expect(calls).toContainEqual(["from", ["applications"]]);
    expect(calls.filter(([name]) => name === "order").map(([, args]) => args)).toEqual([
      ["applied_date", { ascending: false }],
      ["created_at", { ascending: false }],
    ]);
    const selected = calls.find(([name]) => name === "select")?.[1][0] as string;
    expect(selected).toBe("id, title, company, applied_date, location, posting_url, status");
  });

  it("caps the list at the page size", async () => {
    const { client, calls } = fakeClient({ select: { data: [] } });
    await createApplicationReader(client).list();
    expect(calls).toContainEqual(["limit", [LIST_PAGE_SIZE]]);
  });

  it("returns an empty list when no data comes back", async () => {
    const { client } = fakeClient({ select: { data: null } });
    expect(await createApplicationReader(client).list()).toEqual([]);
  });

  it("throws on a query error", async () => {
    const { client } = fakeClient({ select: { error: { code: "XX000" } } });
    await expect(createApplicationReader(client).list()).rejects.toMatchObject({ code: "XX000" });
  });
});

describe("createProfileTimeZoneReader", () => {
  it("returns the profile time zone", async () => {
    const { client, calls } = fakeClient({ select: { data: { timezone: "Asia/Bangkok" } } });
    expect(await createProfileTimeZoneReader(client, "user-1").getTimeZone()).toBe("Asia/Bangkok");
    expect(calls).toContainEqual(["eq", ["id", "user-1"]]);
  });

  it("returns null when the profile row is missing", async () => {
    const { client } = fakeClient({ select: { data: null } });
    expect(await createProfileTimeZoneReader(client, "user-1").getTimeZone()).toBeNull();
  });

  it("throws on a query error", async () => {
    const { client } = fakeClient({ select: { error: { code: "XX000" } } });
    await expect(createProfileTimeZoneReader(client, "user-1").getTimeZone()).rejects.toBeInstanceOf(ApplicationRepositoryError);
  });
});
