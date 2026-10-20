import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";

import ForgotPasswordFlow from "./ForgotPasswordFlow";

export const metadata: Metadata = {
  title: "Forgot Password — NextJobLog",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <ForgotPasswordFlow />
    </AuthPageShell>
  );
}
