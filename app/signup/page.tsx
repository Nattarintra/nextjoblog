import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/AuthLayout";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account — NextJobLog",
};

export default function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
