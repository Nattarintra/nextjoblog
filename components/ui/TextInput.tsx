"use client";

import type { ComponentProps } from "react";

import { controlClassName } from "@/components/ui/control-styles";
import { useFormFieldControl } from "@/components/ui/FormField";

type TextInputProps = Omit<ComponentProps<"input">, "id" | "name" | "required" | "aria-invalid" | "aria-describedby">;

/** Input that takes its id, name and aria wiring from the surrounding FormField. */
export function TextInput({ className, type = "text", ...rest }: TextInputProps) {
  const { id, name, required, invalid, describedBy } = useFormFieldControl();
  return (
    <input
      {...rest}
      id={id}
      name={name}
      type={type}
      required={required}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className={[controlClassName(invalid), className].filter(Boolean).join(" ")}
    />
  );
}
