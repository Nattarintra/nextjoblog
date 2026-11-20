import { Icon } from "@/components/ui/icons";

type ToastProps = {
  title: string;
  body: string;
  dismissLabel: string;
  onDismiss: () => void;
};

export function Toast({ title, body, dismissLabel, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[68px] z-50 flex items-start gap-3 rounded-xl border border-success-text/30 bg-navy px-3.5 py-3 text-sm text-on-dark shadow-xl md:inset-x-auto md:right-7 md:top-6 md:w-[380px]"
    >
      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-success-tint text-success-text" aria-hidden="true">
        <Icon name="check" size={16} />
      </span>
      <span className="flex-1 leading-normal">
        <strong className="block font-semibold">{title}</strong>
        {body}
      </span>
      <button
        className="rounded-md px-1 text-lg leading-none text-on-dark-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-azure"
        type="button"
        aria-label={dismissLabel}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
