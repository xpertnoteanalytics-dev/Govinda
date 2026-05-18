import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = {
  title: "Create organization",
};

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your organization"
      subtitle="Set up your tenant workspace and admin account"
    >
      <SignupForm />
    </AuthLayout>
  );
}
