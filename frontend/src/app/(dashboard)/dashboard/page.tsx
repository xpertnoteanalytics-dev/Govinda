import { PageTransition } from "@/components/ui/motion";
import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards";
import { OperationsOverview } from "@/components/dashboard/OperationsOverview";
import { RecentCalls } from "@/components/dashboard/RecentCalls";
import { RecentOutreach } from "@/components/dashboard/RecentOutreach";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ROLES } from "@/lib/constants";
import { AnimatedCard } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export const metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        <WelcomeHeader />

        <OperationsOverview />
        <RecentOutreach />
        <RecentCalls />
        <AnalyticsCards />

        <RoleGuard minRole={ROLES.TENANT_ADMIN}>
          <AnimatedCard index={5}>
            <CardHeader className="p-0">
              <CardTitle>Admin controls</CardTitle>
              <CardDescription>
                Organization administration for workspace admins
              </CardDescription>
            </CardHeader>
            <ul className="mt-4 space-y-2 text-sm text-ink-muted dark:text-slate-400">
              <li>• Invite and manage team members</li>
              <li>• Configure organization settings</li>
              <li>• View activity logs and operational reports</li>
            </ul>
          </AnimatedCard>
        </RoleGuard>
      </div>
    </PageTransition>
  );
}
