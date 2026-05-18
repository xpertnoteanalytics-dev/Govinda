"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageTransition } from "@/components/ui/motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROLES } from "@/lib/constants";
import { AnimatedCard } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function AdminPage() {
  const { hasMinRole, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !hasMinRole(ROLES.TENANT_ADMIN)) {
      router.replace("/dashboard");
    }
  }, [isLoading, hasMinRole, router]);

  if (isLoading || !hasMinRole(ROLES.TENANT_ADMIN)) {
    return null;
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-ink">Administration</h2>
          <p className="mt-1 text-ink-muted">
            Manage your organization workspace
          </p>
        </div>

        <AnimatedCard>
          <CardHeader className="p-0">
            <CardTitle>Organization admin</CardTitle>
            <CardDescription>
              Tenant-scoped administration panel
            </CardDescription>
          </CardHeader>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            <li>• User management and invitations</li>
            <li>• Role assignments within your tenant</li>
            <li>• Billing and plan configuration</li>
            <li>• Security and compliance settings</li>
          </ul>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}
