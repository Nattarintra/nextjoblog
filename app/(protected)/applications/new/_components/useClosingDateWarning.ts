"use client";

import { useState } from "react";

import { isClosingBeforeApplied } from "@/lib/applications/closing-date";

type ClosingDateWarningState = {
  appliedDate: string;
  closingDate: string;
  setAppliedDate: (date: string) => void;
  setClosingDate: (date: string) => void;
  showWarning: boolean;
};

export function useClosingDateWarning(initialApplied: string, initialClosing: string): ClosingDateWarningState {
  const [appliedDate, setAppliedDate] = useState(initialApplied);
  const [closingDate, setClosingDate] = useState(initialClosing);

  return {
    appliedDate,
    closingDate,
    setAppliedDate,
    setClosingDate,
    showWarning: isClosingBeforeApplied(appliedDate, closingDate),
  };
}
