import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApplicationReader, ApplicationWriter } from "@/lib/applications/ports";
import type { ProfileTimeZoneReader } from "@/lib/applications/time-zone";
import {
  FIELD_NAMES,
  type ApplicationSummary,
  type InsertOutcome,
  type NewApplicationRecord,
} from "@/lib/applications/types";

const APPLICATIONS_TABLE = "applications";
const PROFILES_TABLE = "profiles";
const UNIQUE_VIOLATION_CODE = "23505";

const CONTENT_COLUMNS = FIELD_NAMES.join(", ");
const LIST_COLUMNS = ["id", CONTENT_COLUMNS, "status"].join(", ");

/** Carries only the provider error code, so messages can never leak to callers or logs. */
export class ApplicationRepositoryError extends Error {
  constructor(readonly code?: string) {
    super("Application repository operation failed");
    this.name = "ApplicationRepositoryError";
  }
}

type StoredContent = Record<(typeof FIELD_NAMES)[number], string>;

/** Explicit allow-list of insertable columns (mass-assignment guard). */
function toInsertRow(record: NewApplicationRecord) {
  return {
    id: record.id,
    user_id: record.user_id,
    title: record.title,
    company: record.company,
    applied_date: record.applied_date,
    location: record.location,
    posting_url: record.posting_url,
    status: record.status,
  };
}

function hasSameContent(stored: StoredContent, record: NewApplicationRecord): boolean {
  return FIELD_NAMES.every((field) => stored[field] === record[field]);
}

async function classifyExistingRow(
  client: SupabaseClient,
  record: NewApplicationRecord,
): Promise<InsertOutcome> {
  const { data, error } = await client
    .from(APPLICATIONS_TABLE)
    .select(CONTENT_COLUMNS)
    .eq("id", record.id)
    .eq("user_id", record.user_id)
    .maybeSingle<StoredContent>();
  if (error) throw new ApplicationRepositoryError(error.code);
  return data && hasSameContent(data, record) ? "already_exists" : "id_conflict";
}

export function createApplicationWriter(client: SupabaseClient): ApplicationWriter {
  return {
    async insert(record) {
      const { error } = await client.from(APPLICATIONS_TABLE).insert(toInsertRow(record));
      if (!error) return "inserted";
      if (error.code !== UNIQUE_VIOLATION_CODE) throw new ApplicationRepositoryError(error.code);
      return classifyExistingRow(client, record);
    },
  };
}

export function createApplicationReader(client: SupabaseClient): ApplicationReader {
  return {
    async list() {
      const { data, error } = await client
        .from(APPLICATIONS_TABLE)
        .select(LIST_COLUMNS)
        .order("applied_date", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<ApplicationSummary[]>();
      if (error) throw new ApplicationRepositoryError(error.code);
      return data ?? [];
    },
  };
}

export function createProfileTimeZoneReader(
  client: SupabaseClient,
  userId: string,
): ProfileTimeZoneReader {
  return {
    async getTimeZone() {
      const { data, error } = await client
        .from(PROFILES_TABLE)
        .select("timezone")
        .eq("id", userId)
        .maybeSingle<{ timezone: string }>();
      if (error) throw new ApplicationRepositoryError(error.code);
      return data?.timezone ?? null;
    },
  };
}
