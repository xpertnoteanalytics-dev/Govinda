"use client";

import { FadeIn } from "@/components/ui/motion";
import { WorkflowRibbon } from "@/components/ui/WorkflowRibbon";
import { HEALTHCARE_WORKFLOW_STEPS } from "@/lib/workflow-steps";
import { useAuth } from "@/components/auth/AuthProvider";

export function WelcomeHeader() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="ops-skeleton h-24 w-full rounded-2xl" />;
  }

  return (
    <FadeIn className="space-y-4">
      <div>
        <h2 className="ops-page-title">
          Welcome{user ? `, ${user.firstName}` : ""}
        </h2>
        <p className="ops-page-subtitle">
          {user
            ? `${user.tenant.name} · Healthcare operations hub`
            : "Coordinate care from search to follow-up"}
        </p>
      </div>
      <WorkflowRibbon steps={HEALTHCARE_WORKFLOW_STEPS} activeIndex={5} />
    </FadeIn>
  );
}
