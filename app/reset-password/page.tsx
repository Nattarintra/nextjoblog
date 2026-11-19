import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/AuthLayout";

import ResetPasswordFlow from "./ResetPasswordFlow";

export const metadata: Metadata = {
  title: "Set a New Password — NextJobLog",
};

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <ResetPasswordFlow />
    </AuthLayout>
  );
}
