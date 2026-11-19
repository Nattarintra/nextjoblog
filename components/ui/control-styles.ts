/** Shared look of text-like controls (TextInput, DatePicker trigger). */
export const CONTROL_CLASS = {
  base: "min-h-11 w-full rounded-[10px] border-[1.5px] border-border-strong bg-paper px-3 py-[11px] font-body text-[15px] text-ink placeholder:text-text-3 focus-visible:border-azure focus-visible:outline-[3px] focus-visible:outline-azure/35",
  invalid: "border-danger bg-danger-tint/30",
} as const;

export function controlClassName(invalid: boolean): string {
  return invalid ? `${CONTROL_CLASS.base} ${CONTROL_CLASS.invalid}` : CONTROL_CLASS.base;
}
