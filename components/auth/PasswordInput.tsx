"use client";

import { forwardRef, useId, useState } from "react";

import {
  authErrorClassName,
  authFieldLabelClassName,
  authInputClassName,
  authInputWarningClassName,
  visuallyHiddenClassName,
} from "@/components/auth/styles";
import { PASSWORD_INPUT_MESSAGES } from "@/lib/auth/messages";

type PasswordInputProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  describedBy?: string;
  error?: string | null;
  warning?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  showToggle?: boolean;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  describedBy,
  error = null,
  warning = false,
  placeholder,
  autoFocus = false,
  value,
  onChange,
  onBlur,
  showToggle = true,
}, ref) {
  const inputClassName = `${authInputClassName}${warning ? ` ${authInputWarningClassName}` : ""}${showToggle ? " pr-16" : ""}`;
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
          className={inputClassName}
          id={id}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          required
          aria-invalid={Boolean(error || warning)}
          aria-describedby={describedByIds || undefined}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          ref={ref}
        />
        {showToggle && (
          <button
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold text-sky focus:outline focus:outline-2 focus:outline-azure"
            type="button"
            aria-pressed={isVisible}
            aria-label={PASSWORD_INPUT_MESSAGES.toggleLabel(isVisible, label)}
            onClick={() => setIsVisible((visible) => !visible)}
          >
            {PASSWORD_INPUT_MESSAGES.toggleText(isVisible)}
          </button>
        )}
      </div>
      {error && (
        <div id={errorId} className={authErrorClassName} role="alert">
          {error}
        </div>
      )}
      <span className={visuallyHiddenClassName} aria-live="polite">
        {isVisible ? PASSWORD_INPUT_MESSAGES.visibleAnnouncement(label) : ""}
      </span>
    </div>
  );
});
