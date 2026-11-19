"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import { fieldId } from "@/components/ui/field-ids";
import { UI_MESSAGES } from "@/components/ui/messages";

export type FormFieldControlProps = {
  id: string;
  name: string;
  labelId: string;
  required: boolean;
  invalid: boolean;
  /** Space-separated ids of the help and error text; undefined when neither renders. */
  describedBy: string | undefined;
};

const FormFieldContext = createContext<FormFieldControlProps | null>(null);

/** Wiring a control must apply to itself; throws if used outside a FormField. */
export function useFormFieldControl(): FormFieldControlProps {
  const control = useContext(FormFieldContext);
  if (!control) throw new Error("useFormFieldControl must be used inside <FormField>");
  return control;
}

type FormFieldProps = {
  name: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  /** Lets a field take the full row of a two-column grid. */
  span?: "full";
  children: ReactNode;
};

export function FormField({ name, label, required = false, help, error, span, children }: FormFieldProps) {
  const id = fieldId(name);
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : undefined, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`mb-4 flex flex-col gap-1.5 ${span === "full" ? "md:col-span-2" : ""}`}>
      <label id={labelId} htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="text-danger-text">
            <span aria-hidden="true">{UI_MESSAGES.requiredMarker}</span>
            <span className="sr-only">{UI_MESSAGES.requiredSrText}</span>
          </span>
        )}
      </label>
      <FormFieldContext.Provider value={{ id, name, labelId, required, invalid: Boolean(error), describedBy }}>
        {children}
      </FormFieldContext.Provider>
      {help && (
        <span id={helpId} className="text-[13px] text-text-3">
          {help}
        </span>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-[7px] text-[13.5px] font-medium text-danger-text">
          <span aria-hidden="true" className="mt-0.5 inline-flex size-4 flex-none items-center justify-center rounded-full bg-danger font-mono text-[11px] font-semibold text-on-dark">
            !
          </span>
          {error}
        </p>
      )}
    </div>
  );
}
