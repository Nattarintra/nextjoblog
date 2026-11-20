import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui/icons";
import { AUTH_BRAND_MESSAGES } from "@/lib/auth/messages";

/** Decorative duplicate copy: hidden from the accessibility tree on purpose. */
export function AuthBrandPanel() {
  return (
    <aside
      aria-hidden="true"
      className="hidden w-[46%] flex-none flex-col justify-between bg-[linear-gradient(160deg,var(--auth-brand-from),var(--auth-brand-to))] p-12 text-on-dark md:flex"
    >
      <div className="flex items-center gap-3 font-display text-xl font-bold">
        <Logo size={40} />
        {AUTH_BRAND_MESSAGES.productName}
      </div>
      <div className="max-w-[420px]">
        <h2 className="font-display text-[32px] leading-tight font-bold">{AUTH_BRAND_MESSAGES.headline}</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-on-dark-2">{AUTH_BRAND_MESSAGES.paragraph}</p>
        <ul className="mt-6 grid gap-3 text-[15px] text-on-dark-2">
          {AUTH_BRAND_MESSAGES.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-none text-sky">
                <Icon name="check" size={18} />
              </span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <div className="font-mono text-xs text-on-dark-3">{AUTH_BRAND_MESSAGES.footer}</div>
    </aside>
  );
}
