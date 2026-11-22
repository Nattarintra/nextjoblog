"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";

import { Chip } from "@/components/ui/Chip";
import { useFormFieldControl } from "@/components/ui/FormField";

export type TagRejectionReason = "empty" | "duplicate" | "too_long" | "too_many";
export type TagAddResult =
  | { status: "added"; tags: string[] }
  | { status: "rejected"; reason: TagRejectionReason };

type TagMessage = string | ((tag: string) => string);
type TagInputProps = {
  defaultValue?: readonly string[];
  addTag: (tags: string[], raw: string) => TagAddResult;
  placeholder?: string;
  removeLabel: (tag: string) => string;
  announce?: { added?: TagMessage; removed?: TagMessage; rejected?: TagMessage };
  rejectionMessages?: Partial<Record<TagRejectionReason, string>>;
};

function resolveMessage(message: TagMessage | undefined, value: string): string {
  return typeof message === "function" ? message(value) : message ?? "";
}

export function TagInput({ defaultValue = [], addTag, placeholder, removeLabel, announce, rejectionMessages = {} }: TagInputProps) {
  const { id, name, labelId, invalid, describedBy } = useFormFieldControl();
  const [tags, setTags] = useState([...defaultValue]);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const add = (raw: string) => {
    const result = addTag(tags, raw);
    if (result.status === "added") {
      const added = result.tags[result.tags.length - 1];
      setTags(result.tags);
      setDraft("");
      setAnnouncement(resolveMessage(announce?.added, added));
    } else {
      setAnnouncement(rejectionMessages[result.reason] ?? resolveMessage(announce?.rejected, result.reason));
    }
  };

  const remove = (tag: string) => {
    setTags((current) => current.filter((item) => item !== tag));
    setAnnouncement(resolveMessage(announce?.removed, tag));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      remove(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-[7px] rounded-[10px] border-[1.5px] bg-(--surface-control-bg) p-2 ${
        invalid
          ? "border-(--surface-control-invalid-border) bg-(--surface-control-invalid-bg)"
          : "border-(--surface-control-border)"
      }`}
    >
      <ul aria-label={`${labelId} tags`} className="contents">
        {tags.map((tag) => (
          <li key={tag}><Chip onRemove={() => remove(tag)} removeLabel={removeLabel(tag)}>{tag}</Chip></li>
        ))}
      </ul>
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => { if (draft) add(draft); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-labelledby={labelId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="min-h-8 min-w-[120px] flex-1 border-0 bg-transparent px-[5px] py-[5px] font-body text-[15px] text-(--surface-control-text) placeholder:text-(--surface-control-placeholder) focus:outline-none"
      />
      {tags.map((tag) => <input key={tag} type="hidden" name={name} value={tag} />)}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  );
}
