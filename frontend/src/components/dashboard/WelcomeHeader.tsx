"use client";

import { FadeIn } from "@/components/ui/motion";
import { useAuth } from "@/components/auth/AuthProvider";

export function WelcomeHeader() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-16 animate-pulse rounded-xl bg-slate-200/60" />
    );
  }

  return (
    <FadeIn>
      <div>
        <h2 className="text-2xl font-bold text-ink">
          Welcome{user ? `, ${user.firstName}` : ""}
        </h2>
        <p className="mt-1 text-ink-muted">
          {user
            ? `Managing ${user.tenant.name} · ${user.tenant.plan} plan`
            : "Your healthcare operations hub"}
        </p>
      </div>
    </FadeIn>
  );
}
