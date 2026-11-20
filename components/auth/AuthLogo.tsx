import { Logo } from "@/components/Logo";

type AuthLogoProps = { size?: 36 | 40 };

export function AuthLogo({ size = 40 }: AuthLogoProps) {
  return (
    <div className="mb-6.5 md:hidden" role="img" aria-label="NextJobLog">
      <Logo size={size} />
    </div>
  );
}
