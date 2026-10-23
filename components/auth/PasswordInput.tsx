"use client";

import { useId, useState } from "react";

import {
  authFieldLabelClassName,
  authInputClassName,
  visuallyHiddenClassName,
} from "@/components/auth/styles";

type PasswordInputProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  describedBy?: string;
  error?: string | null;
  placeholder?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  showToggle?: boolean;
};

export function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  describedBy,
  error = null,
  placeholder,
  value,
  onChange,
  showToggle = true,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const generatedErrorId = useId();
  const errorId = `${id}-error-${generatedErrorId.replace(/:/g, "")}`;
  const describedByIds = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ");

  return (
    <div>
      <label htmlFor={id} className={authFieldLabelClassName}>
        {label}
      </label>
      <div className="relative">
        <input
          className={`${authInputClassName}${showToggle ? " pr-16" : ""}`}
          id={id}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={describedByIds || undefined}
          value={value}
          onChange={onChange}
        />
        {showToggle && (
          <button
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold text-sky focus:outline focus:outline-2 focus:outline-azure"
            type="button"
            aria-pressed={isVisible}
            aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            onClick={() => setIsVisible((visible) => !visible)}
          >
            {isVisible ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && (
        <div id={errorId} className="mt-1.25 text-[11px] text-auth-danger" role="alert">
          {error}
        </div>
      )}
      <span className={visuallyHiddenClassName} aria-live="polite">
        {isVisible ? `Password is visible for ${label.toLowerCase()}.` : ""}
      </span>
    </div>
  );
}
