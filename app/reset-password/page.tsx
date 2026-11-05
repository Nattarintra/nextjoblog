import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";

import ResetPasswordFlow from "./ResetPasswordFlow";

export const metadata: Metadata = {
  title: "Set a New Password — NextJobLog",
};

export default function ResetPasswordPage() {
  return (
    <AuthPageShell>
      <ResetPasswordFlow />
    </AuthPageShell>
  );
}
