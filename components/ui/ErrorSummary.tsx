"use client";

import type { MouseEvent, Ref } from "react";

import { Alert } from "@/components/ui/Alert";

export type ErrorSummaryItem = { fieldId: string; message: string };

type ErrorSummaryProps = {
  heading: string;
  items: readonly ErrorSummaryItem[];
  ref?: Ref<HTMLDivElement>;
};

function focusField(event: MouseEvent<HTMLAnchorElement>, fieldId: string): void {
  const target = document.getElementById(fieldId);
  if (!target) return;
  event.preventDefault();
  target.focus();
}

/** Lists every field error with a link that moves focus to its control. */
export function ErrorSummary({ heading, items, ref }: ErrorSummaryProps) {
  return (
    <Alert ref={ref} tone="danger" className="border-l-4 border-danger">
      <b className="font-semibold">{heading}</b>
      <ul className="mt-1.5 list-disc pl-[18px]">
        {items.map(({ fieldId, message }) => (
          <li key={fieldId}>
            <a href={`#${fieldId}`} onClick={(event) => focusField(event, fieldId)} className="font-semibold text-danger-text underline">
              {message}
            </a>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
