import type { ReactNode } from "react";

import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";

export function DefinitionList({ children }: { children: ReactNode }) {
  return <dl className="grid">{children}</dl>;
}

export function DefinitionRow({ term, children }: { term: string; children: ReactNode }) {
  const isEmpty = children === null || children === undefined || children === "";
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0">
      <dt className="text-sm text-text-2">{term}</dt>
      <dd className={`m-0 text-right text-sm font-medium ${isEmpty ? "text-text-3 font-normal" : "text-ink"}`}>
        {isEmpty ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{APPLICATION_PAGE_MESSAGES.notProvided}</span>
          </>
        ) : children}
      </dd>
    </div>
  );
}
