import { FIELD_NAMES, type ApplicationFormValues } from "@/lib/applications/types";

export const CLIENT_ID_FIELD = "client_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApplicationFormData {
  values: ApplicationFormValues;
  /** Client-generated id used for idempotent retries; null when absent or malformed. */
  clientId: string | null;
}

function readString(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

export function readApplicationFormData(formData: FormData): ApplicationFormData {
  const values = Object.fromEntries(
    FIELD_NAMES.map((field) => [field, readString(formData, field)]),
  ) as ApplicationFormValues;
  const clientId = readString(formData, CLIENT_ID_FIELD);
  return { values, clientId: UUID_PATTERN.test(clientId) ? clientId : null };
}
