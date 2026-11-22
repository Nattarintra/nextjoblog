"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { DayPicker } from "react-day-picker";
import type { DayPickerProps } from "react-day-picker";

import { controlClassName } from "@/components/ui/control-styles";
import { useFormFieldControl } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/icons";
import { UI_MESSAGES } from "@/components/ui/messages";
import { formatDisplayDate, isoToLocalDate, localDateToIso } from "@/lib/applications/dates";

const CALENDAR_ICON_SIZE = 18;
const NAV_ICON_SIZE = 18;

const CALENDAR_CLASS_NAMES: NonNullable<DayPickerProps["classNames"]> = {
  root: "p-3",
  months: "relative",
  month_caption: "mb-2 flex h-10 items-center justify-center",
  caption_label: "font-display text-[15px] font-bold text-ink",
  nav: "absolute inset-x-0 top-0 flex h-10 items-center justify-between",
  button_previous: "inline-flex size-11 items-center justify-center rounded-[10px] text-ink hover:bg-subtle focus-visible:outline-[3px] focus-visible:outline-azure",
  button_next: "inline-flex size-11 items-center justify-center rounded-[10px] text-ink hover:bg-subtle focus-visible:outline-[3px] focus-visible:outline-azure",
  month_grid: "border-collapse",
  weekday: "size-11 text-center text-xs font-semibold text-text-3",
  day: "p-0 text-center",
  day_button: "size-11 rounded-[10px] text-sm text-ink hover:bg-mist focus-visible:outline-[3px] focus-visible:outline-azure",
  selected: "[&>button]:bg-azure [&>button]:font-semibold [&>button]:text-on-dark [&>button]:hover:bg-azure",
  today: "[&>button]:font-bold [&>button]:text-cobalt [&>button]:underline",
  outside: "opacity-50",
};

type DatePickerProps = {
  /** Initial ISO date (YYYY-MM-DD); the form owns nothing else about it. */
  defaultValue?: string;
  /** ISO date highlighted as "today"; injected so tests and time zones stay deterministic. */
  today: string;
  onChange?: (isoDate: string) => void;
  clearable?: boolean;
};

/**
 * Calendar-only date control (no typing). Posts the ISO date through a hidden
 * input named by the surrounding FormField.
 */
export function DatePicker({ defaultValue = "", today, onChange, clearable = false }: DatePickerProps) {
  const { id, name, labelId, invalid, describedBy } = useFormFieldControl();
  const [value, setValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const valueId = useId();
  const dialogId = useId();
  const label = UI_MESSAGES.datePicker;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = localDateToIso(date);
    setValue(iso);
    onChange?.(iso);
    close();
  };

  const clear = () => {
    setValue("");
    onChange?.("");
    close();
  };

  const selected = isoToLocalDate(value);
  const todayDate = isoToLocalDate(today);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-describedby={describedBy}
        className={`${controlClassName(invalid)} flex items-center justify-between gap-2 text-left`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span id={valueId} className={value ? "" : "text-text-3"}>
          {value ? formatDisplayDate(value) : label.placeholder}
        </span>
        <span className="text-text-2">
          <Icon name="calendar" size={CALENDAR_ICON_SIZE} />
        </span>
      </button>
      {isOpen && (
        <div
          id={dialogId}
          role="dialog"
          aria-labelledby={labelId}
          className="absolute left-0 z-30 mt-1.5 rounded-[14px] border border-border bg-paper shadow-lg"
        >
          <DayPicker
            mode="single"
            autoFocus
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? todayDate}
            today={todayDate}
            classNames={CALENDAR_CLASS_NAMES}
            labels={{ labelPrevious: () => label.previousMonth, labelNext: () => label.nextMonth }}
            components={{
              Chevron: ({ orientation }) => (
                <Icon name={orientation === "left" ? "chevronLeft" : "chevronRight"} size={NAV_ICON_SIZE} />
              ),
            }}
          />
          {clearable && value && (
            <div className="border-t border-border p-3">
              <button type="button" className="min-h-11 w-full rounded-[10px] px-3 text-sm font-semibold text-link hover:bg-subtle focus-visible:outline-[3px] focus-visible:outline-azure" onClick={clear}>
                {label.clear}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
