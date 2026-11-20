import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/AuthLayout";

import ForgotPasswordFlow from "./ForgotPasswordFlow";

export const metadata: Metadata = {
  title: "Forgot Password — NextJobLog",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <ForgotPasswordFlow />
    </AuthLayout>
  );
}
