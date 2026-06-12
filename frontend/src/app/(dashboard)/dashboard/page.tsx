
import { PageTransition } from "@/components/ui/motion";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ROLES } from "@/lib/constants";
import { AnimatedCard } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { OutreachTrendChart } from "@/components/dashboard/OutreachTrendChart";
import { AppointmentDonut } from "@/components/dashboard/AppointmentDonut";
import { FeedbackDonut } from "@/components/dashboard/FeedbackDonut";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { TopServices } from "@/components/dashboard/TopServices";
import { AiInsights } from "@/components/dashboard/AiInsights";
import { GeoCoverage } from "@/components/dashboard/GeoCoverage";

export const metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <PageTransition>
      <div className="space-y-6">

        <WelcomeHeader />

        <KpiCards />

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <OutreachTrendChart />
          </div>
          <div className="xl:col-span-1">
            <AppointmentDonut />
          </div>
          <div className="xl:col-span-1">
            <FeedbackDonut />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RecentActivities />
          <TopServices />
          <AiInsights />
          <GeoCoverage />
        </div>

        <RoleGuard minRole={ROLES.TENANT_ADMIN}>
          <AnimatedCard index={8}>
            <CardHeader className="p-0">
              <CardTitle>Admin Controls</CardTitle>
              <CardDescription>
                Organization administration features for tenant admins
              </CardDescription>
            </CardHeader>
            <ul className="mt-4 space-y-2 text-sm text-ink-muted">
              <li>• Invite and manage team members</li>
              <li>• Configure organization settings</li>
              <li>• View audit logs and compliance reports</li>
            </ul>
          </AnimatedCard>
        </RoleGuard>

      </div>
    </PageTransition>
  );
}