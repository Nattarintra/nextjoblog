import { describe, expect, it, vi } from "vitest";

import { APPLICATION_EVENTS } from "@/lib/applications/log";
import { logApplication } from "@/lib/applications/log-application";
import type { ApplicationWriter } from "@/lib/applications/ports";
import type { ApplicationFormValues, InsertOutcome } from "@/lib/applications/types";

const USER_ID = "user-1";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const VALID_VALUES: ApplicationFormValues = {
  title: "  Frontend Developer ",
  company: "Acme",
  applied_date: "2026-11-19",
  location: "Stockholm",
  posting_url: "https://acme.test/jobs/1",
};

function setup(outcomes: Array<InsertOutcome | Error> = ["inserted"]) {
  const queue = [...outcomes];
  const insert = vi.fn<ApplicationWriter["insert"]>(async () => {
    const next = queue.shift() ?? "inserted";
    if (next instanceof Error) throw next;
    return next;
  });
  const writer: ApplicationWriter = { insert };
  const ids = ["generated-1", "generated-2"];
  const newId = vi.fn(() => ids.shift() ?? "generated-n");
  const log = vi.fn();
  return { insert, newId, log, deps: { writer, newId, log } };
}

describe("logApplication", () => {
  it("saves trimmed values with status applied and the client id", async () => {
    const { deps, insert, newId } = setup();
    const result = await logApplication(deps, { userId: USER_ID, clientId: CLIENT_ID, values: VALID_VALUES });
    expect(result).toEqual({ status: "created", id: CLIENT_ID });
    expect(insert).toHaveBeenCalledWith({
      id: CLIENT_ID,
      user_id: USER_ID,
      title: "Frontend Developer",
      company: "Acme",
      applied_date: "2026-11-19",
      location: "Stockholm",
      posting_url: "https://acme.test/jobs/1",
      status: "applied",
    });
    expect(newId).not.toHaveBeenCalled();
  });

  it("generates an id when the client id is missing", async () => {
    const { deps, insert } = setup();
    const result = await logApplication(deps, { userId: USER_ID, clientId: null, values: VALID_VALUES });
    expect(result).toEqual({ status: "created", id: "generated-1" });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("returns every field error without calling the writer when input is invalid", async () => {
    const { deps, insert } = setup();
    const values = { title: "", company: " ", applied_date: "", location: "", posting_url: "linkedin job" };
    const result = await logApplication(deps, { userId: USER_ID, clientId: CLIENT_ID, values });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(Object.keys(result.errors)).toHaveLength(5);
      expect(result.values).toEqual(values);
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats an already stored identical row as created", async () => {
    const { deps, insert } = setup(["already_exists"]);
    const result = await logApplication(deps, { userId: USER_ID, clientId: CLIENT_ID, values: VALID_VALUES });
    expect(result).toEqual({ status: "created", id: CLIENT_ID });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("retries once with a fresh id on an id conflict", async () => {
    const { deps, insert } = setup(["id_conflict", "inserted"]);
    const result = await logApplication(deps, { userId: USER_ID, clientId: CLIENT_ID, values: VALID_VALUES });
    expect(result).toEqual({ status: "created", id: "generated-1" });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[1][0]).toMatchObject({ id: "generated-1" });
  });

  it("returns an error with the user's input after a second conflict", async () => {
    const { deps, insert, log } = setup(["id_conflict", "id_conflict"]);
    const result = await logApplication(deps, { userId: USER_ID, clientId: CLIENT_ID, values: VALID_VALUES });
    expect(result).toEqual({ status: "error", values: VALID_VALUES });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(APPLICATION_EVENTS.idConflict);
  });

  it("returns an error and logs only the code when the writer throws", async () => {
    const failure = Object.assign(new Error("secret db detail"), { code: "08006" });
    const { deps, log } = setup([failure]);
    const result = await logApplication(deps, { userId: USER_ID, clientId: CLIENT_ID, values: VALID_VALUES });
    expect(result).toEqual({ status: "error", values: VALID_VALUES });
    expect(log).toHaveBeenCalledWith(APPLICATION_EVENTS.saveFailed, { code: "08006" });
  });
});
