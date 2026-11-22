"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import { LABEL_CLASS } from "@/components/ui/control-styles";
import { fieldId } from "@/components/ui/field-ids";

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
  id?: string;
  required?: boolean;
  invalid?: boolean;
  help?: string;
  error?: string;
  warning?: string;
  as?: "group";
  /** Lets a field take the full row of a two-column grid. */
  span?: "full";
  children: ReactNode;
};

export function FormField({ name, label, id: explicitId, required = false, invalid = false, help, error, warning, as, span, children }: FormFieldProps) {
  const id = explicitId ?? fieldId(name);
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const warningId = `${id}-warning`;
  const describedBy = [help ? helpId : undefined, error ? errorId : undefined, warning ? warningId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`mb-4 flex flex-col gap-1.5 ${span === "full" ? "md:col-span-2" : ""}`}>
      {as === "group" ? (
        <div role="group" aria-labelledby={labelId}>
          <FormFieldContext.Provider value={{ id, name, labelId, required, invalid: invalid || Boolean(error), describedBy }}>
            {children}
          </FormFieldContext.Provider>
        </div>
      ) : (
        <>
          <label
            id={labelId}
            htmlFor={id}
            className={`${LABEL_CLASS} ${required ? "after:ml-1.5 after:text-(--surface-required) after:content-['*']" : ""}`}
          >
            {label}
          </label>
          <FormFieldContext.Provider value={{ id, name, labelId, required, invalid: invalid || Boolean(error), describedBy }}>
            {children}
          </FormFieldContext.Provider>
        </>
      )}
      {help && (
        <span id={helpId} className="text-[13.5px] text-(--surface-help)">
          {help}
        </span>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-[7px] text-[13.5px] font-medium text-(--surface-error-text)">
          <span aria-hidden="true" className="mt-0.5 inline-flex size-4 flex-none items-center justify-center rounded-full bg-danger font-mono text-[11px] font-semibold text-on-dark">
            !
          </span>
          {error}
        </p>
      )}
      {warning && (
        <p id={warningId} role="status" className="flex items-start gap-[7px] text-[13.5px] font-medium text-warning-text">
          <span aria-hidden="true" className="mt-0.5 inline-flex size-4 flex-none items-center justify-center rounded-full bg-warning font-mono text-[11px] font-semibold text-on-dark">
            !
          </span>
          {warning}
        </p>
      )}
    </div>
  );
}
