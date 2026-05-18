import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your organization dashboard"
    >
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
