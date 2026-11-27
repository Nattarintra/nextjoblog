import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_APPLICATION_LIST_ROWS } from "@/lib/applications/limits";
import type {
  ApplicationDetailReader,
  ApplicationReader,
  ApplicationWriter,
} from "@/lib/applications/ports";
import type { ProfileTimeZoneReader } from "@/lib/applications/time-zone";
import { isUuid } from "@/lib/applications/uuid";
import {
  FIELD_NAMES,
  OPTIONAL_FIELD_NAMES,
  type ApplicationDetail,
  type ApplicationSummary,
  type InsertOutcome,
  type NewApplicationRecord,
} from "@/lib/applications/types";

const APPLICATIONS_TABLE = "applications";
const PROFILES_TABLE = "profiles";
const UNIQUE_VIOLATION_CODE = "23505";

const CONTENT_COLUMNS = FIELD_NAMES.join(", ");
const LIST_COLUMNS = ["id", CONTENT_COLUMNS, "status"].join(", ");
const IDEMPOTENCY_COLUMNS = [...FIELD_NAMES, ...OPTIONAL_FIELD_NAMES] as const;
const DETAIL_COLUMNS = ["id", ...IDEMPOTENCY_COLUMNS, "status"].join(", ");

/** Carries only the provider error code, so messages can never leak to callers or logs. */
export class ApplicationRepositoryError extends Error {
  constructor(readonly code?: string) {
    super("Application repository operation failed");
    this.name = "ApplicationRepositoryError";
  }
}

type StoredContent = Pick<ApplicationDetail, (typeof IDEMPOTENCY_COLUMNS)[number]>;

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
    closing_date: record.closing_date,
    salary_info: record.salary_info,
    work_format: record.work_format,
    contract_type: record.contract_type,
    discipline: record.discipline,
    tech_stack: record.tech_stack,
  };
}

function hasSameContent(stored: StoredContent, record: NewApplicationRecord): boolean {
  return IDEMPOTENCY_COLUMNS.every((field) => sameValue(stored[field], record[field]));
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

async function classifyExistingRow(
  client: SupabaseClient,
  record: NewApplicationRecord,
): Promise<InsertOutcome> {
  const { data, error } = await client
    .from(APPLICATIONS_TABLE)
    .select(IDEMPOTENCY_COLUMNS.join(", "))
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
        .limit(MAX_APPLICATION_LIST_ROWS)
        .returns<ApplicationSummary[]>();
      if (error) throw new ApplicationRepositoryError(error.code);
      return data ?? [];
    },
  };
}

export function createApplicationDetailReader(client: SupabaseClient): ApplicationDetailReader {
  return {
    async get(id) {
      if (!isUuid(id)) return null;

      const { data, error } = await client
        .from(APPLICATIONS_TABLE)
        .select(DETAIL_COLUMNS)
        .eq("id", id)
        .maybeSingle<ApplicationDetail>();
      if (error) throw new ApplicationRepositoryError(error.code);
      return data ?? null;
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
