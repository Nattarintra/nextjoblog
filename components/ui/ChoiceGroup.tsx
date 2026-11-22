"use client";

import { useState } from "react";

import { useFormFieldControl } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/icons";

export type ChoiceOption = { value: string; label: string };

type ChoiceGroupProps = {
  legend: string;
  options: readonly ChoiceOption[];
  defaultValue?: string;
  clearLabel: string;
};

export function ChoiceGroup({ legend, options, defaultValue = "", clearLabel }: ChoiceGroupProps) {
  const { id, name, labelId, invalid, describedBy } = useFormFieldControl();
  const [value, setValue] = useState(defaultValue);

  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={describedBy} aria-invalid={invalid} className="choice-group-options flex flex-wrap border-0 p-0">
      <legend id={labelId} className="mb-2 text-sm font-semibold text-(--surface-label)">{legend}</legend>
      {options.map((option, index) => {
        const optionId = `${id}-${option.value}`;
        const selected = value === option.value;
        const move = (direction: 1 | -1) => {
          const nextIndex = (index + direction + options.length) % options.length;
          const nextOption = options[nextIndex];
          setValue(nextOption.value);
          document.getElementById(`${id}-${nextOption.value}`)?.focus();
        };
        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className={`choice-pill inline-flex min-h-11 cursor-pointer items-center gap-1 font-semibold focus-within:outline-[3px] focus-within:outline-azure md:gap-1.5 ${selected ? "is-selected" : ""}`}
          >
            <input
              id={optionId}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onClick={(event) => {
                if (value === option.value) {
                  event.preventDefault();
                  setValue("");
                }
              }}
              onChange={() => setValue(option.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  move(-1);
                }
              }}
              className="sr-only"
            />
            {selected && <Icon name="check" size={15} />}
            {option.label}
          </label>
        );
      })}
      {value && (
        <button type="button" className="min-h-11 rounded-full px-2 text-[13px] font-semibold text-link underline-offset-2 hover:bg-subtle hover:underline focus-visible:outline-[3px] focus-visible:outline-azure md:px-3 md:text-sm" onClick={() => setValue("")}>
          {clearLabel}
        </button>
      )}
    </fieldset>
  );
}
