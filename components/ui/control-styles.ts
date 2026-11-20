/** Shared look of text-like controls (TextInput, DatePicker trigger, PasswordInput). Colours come from --surface-* variables. */
export const CONTROL_CLASS = {
  base: "min-h-[44px] w-full rounded-[10px] border-[1.5px] border-(--surface-control-border) bg-(--surface-control-bg) px-3 py-[11px] font-body text-[15px] text-(--surface-control-text) placeholder:text-(--surface-control-placeholder) focus-visible:border-azure focus-visible:outline-[3px] focus-visible:outline-azure/35",
  invalid: "border-auth-danger border-(--surface-control-invalid-border) bg-(--surface-control-invalid-bg)",
} as const;

/** Shared label class, exported so PasswordInput matches FormField labels. */
export const LABEL_CLASS = "flex items-baseline gap-1.5 text-sm font-semibold text-(--surface-label)";

export function controlClassName(invalid: boolean): string {
  return invalid ? `${CONTROL_CLASS.base} ${CONTROL_CLASS.invalid}` : CONTROL_CLASS.base;
}
