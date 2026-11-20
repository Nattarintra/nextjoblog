import { MAX_TAG_COUNT, MAX_TAG_LENGTH, TAG_LIMITS } from "@/lib/applications/limits";

export type AddTagResult =
  | { status: "added"; tags: string[] }
  | { status: "rejected"; reason: "empty" | "duplicate" | "too_long" | "too_many" };

export function normalizeTag(raw: string): string {
  return raw.trim().normalize("NFC");
}

export function addTag(tags: readonly string[], raw: string, limits = TAG_LIMITS): AddTagResult {
  const tag = normalizeTag(raw);
  if (!tag) return { status: "rejected", reason: "empty" };
  if (tag.length > limits.maxLength) return { status: "rejected", reason: "too_long" };
  if (tags.some((existing) => normalizeTag(existing).toLocaleLowerCase() === tag.toLocaleLowerCase())) {
    return { status: "rejected", reason: "duplicate" };
  }
  if (tags.length >= limits.maxCount) return { status: "rejected", reason: "too_many" };
  return { status: "added", tags: [...tags, tag] };
}

export function removeTag(tags: readonly string[], tag: string): string[] {
  const normalized = normalizeTag(tag).toLocaleLowerCase();
  return tags.filter((existing) => normalizeTag(existing).toLocaleLowerCase() !== normalized);
}

export function normalizeTags(rawTags: readonly string[]): string[] {
  return rawTags.reduce<string[]>((tags, raw) => {
    const result = addTag(tags, raw, { maxCount: MAX_TAG_COUNT, maxLength: MAX_TAG_LENGTH });
    return result.status === "added" ? result.tags : tags;
  }, []);
}
