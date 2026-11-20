import { describe, expect, it } from "vitest";

import { readApplicationFormData } from "@/lib/applications/form-data";

const CLIENT_ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

function formWith(entries: Record<string, string | Blob>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.append(key, value);
  return formData;
}

describe("readApplicationFormData", () => {
  it("reads the five fields and a valid client id", () => {
    const { values, clientId } = readApplicationFormData(
      formWith({ title: "T", company: "C", applied_date: "2026-11-17", location: "L", posting_url: "https://x.co", client_id: CLIENT_ID }),
    );
    expect(values).toEqual({ title: "T", company: "C", applied_date: "2026-11-17", location: "L", posting_url: "https://x.co" });
    expect(clientId).toBe(CLIENT_ID);
  });

  it("defaults missing fields to empty strings and ignores unknown keys", () => {
    const { values } = readApplicationFormData(formWith({ title: "T", user_id: "spoof", status: "offer_received" }));
    expect(values).toEqual({ title: "T", company: "", applied_date: "", location: "", posting_url: "" });
    expect(values).not.toHaveProperty("user_id");
  });

  it("treats file entries as empty", () => {
    const { values } = readApplicationFormData(formWith({ title: new Blob(["x"]) }));
    expect(values.title).toBe("");
  });

  it.each(["", "not-a-uuid", "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b-extra"])("rejects client id %j", (client_id) => {
    expect(readApplicationFormData(formWith({ client_id })).clientId).toBeNull();
  });
});
