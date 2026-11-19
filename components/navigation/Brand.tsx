import { Logo } from "@/components/Logo";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

type BrandProps = { logoSize: number; className?: string };

export function Brand({ logoSize, className = "" }: BrandProps) {
  return (
    <span className={`flex items-center gap-2.5 font-display font-extrabold ${className}`}>
      <Logo size={logoSize} />
      {NAV_MESSAGES.brand}
    </span>
  );
}
