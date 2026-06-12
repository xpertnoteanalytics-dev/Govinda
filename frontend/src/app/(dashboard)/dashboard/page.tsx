import { PageTransition } from "@/components/ui/motion";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ROLES } from "@/lib/constants";
import { AnimatedCard } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
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

        {/* Row 1 — 6 KPI cards */}
        <KpiCards />

        {/* Row 2 — Trend chart + 2 donuts */}
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

        {/* Row 3 — Operations grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RecentActivities />
          <TopServices />
          <AiInsights />
          <GeoCoverage />
        </div>

      </div>
    </PageTransition>
  );
}