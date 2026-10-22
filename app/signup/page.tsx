import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account — NextJobLog",
};

export default function SignupPage() {
  return (
    <AuthPageShell>
      <SignupForm />
    </AuthPageShell>
  );
}
