import type { Metadata } from "next";
import { Archivo, Work_Sans } from "next/font/google";

import SignupForm from "./SignupForm";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: "700",
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Create Account — NextJobLog",
};

export default function SignupPage() {
  return (
    <div
      className={`${archivo.variable} ${workSans.variable}`}
      style={{
        minHeight: "100svh",
        background: "#042c53",
        color: "#fff",
        fontFamily: "var(--font-work-sans)",
      }}
    >
      <SignupForm />
    </div>
  );
}
