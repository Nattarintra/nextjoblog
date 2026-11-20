"use client";

import { forwardRef, useId, useState } from "react";

import { controlClassName, LABEL_CLASS } from "@/components/ui/control-styles";
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
  const inputClassName = `${controlClassName(Boolean(error || warning))}${showToggle ? " pr-16" : ""}`;
  const [isVisible, setIsVisible] = useState(false);
  const generatedErrorId = useId();
  const errorId = `${id}-error-${generatedErrorId.replace(/:/g, "")}`;
  const describedByIds = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ");

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
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
            className="absolute top-1/2 right-2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-sky focus:outline focus:outline-2 focus:outline-azure"
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
        <div id={errorId} className="mt-1.5 text-[13.5px] font-medium text-(--surface-error-text)" role="alert">
          {error}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {isVisible ? PASSWORD_INPUT_MESSAGES.visibleAnnouncement(label) : ""}
      </span>
    </div>
  );
});
