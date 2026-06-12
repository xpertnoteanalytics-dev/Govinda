"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Mail, MessageCircle, Calendar, ChevronRight, Loader2 } from "lucide-react";
import { getOperationsOverview, type OperationsOverview } from "@/lib/operations-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  description: string;
  time: string;
};

function buildActivities(data: OperationsOverview): Activity[] {
  const items: Activity[] = [];

  data.outreach.recent.slice(0, 3).forEach((r, i) => {
    const isEmail = r.channel === "email";
    const isWa = r.channel === "whatsapp";
    items.push({
      id: `outreach-${i}`,
      icon: isEmail ? Mail : isWa ? MessageCircle : Phone,
      iconBg: isEmail
        ? "bg-violet-50 dark:bg-violet-500/10"
        : isWa
        ? "bg-emerald-50 dark:bg-emerald-500/10"
        : "bg-sky-50 dark:bg-sky-500/10",
      iconColor: isEmail
        ? "text-violet-600 dark:text-violet-400"
        : isWa
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-sky-600 dark:text-sky-400",
      description: isEmail
        ? `Email sent to ${r.placeName}`
        : isWa
        ? `WhatsApp message sent to ${r.placeName}`
        : `Call placed to ${r.placeName}`,
      time: new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  data.calls.recent.slice(0, 2).forEach((r, i) => {
    items.push({
      id: `call-${i}`,
      icon: Phone,
      iconBg: "bg-brand-50 dark:bg-brand-500/10",
      iconColor: "text-brand-600 dark:text-brand-400",
      description: `${r.status === "completed" ? "Follow-up call completed" : "Call initiated"} with ${r.placeName}`,
      time: new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  // Add a generic appointment entry
  items.push({
    id: "appt-0",
    icon: Calendar,
    iconBg: "bg-orange-50 dark:bg-orange-500/10",
    iconColor: "text-orange-600 dark:text-orange-400",
    description: "New appointment scheduled",
    time: "10:30 AM",
  });

  return items.slice(0, 5);
}

export function RecentActivities() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOperationsOverview()
      .then((data) => setActivities(buildActivities(data)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <AnimatedCard index={4} className="h-full">
      <CardHeader className="flex flex-row items-start justify-between p-0">
        <div>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Latest outreach events</CardDescription>
        </div>
        <Link
          href="/dashboard/outreach"
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <div className="mt-4">
        {error && (
          <p className="text-sm text-clinical-danger">{error}</p>
        )}
        {!activities && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          </div>
        )}
        {activities && (
          <ul className="space-y-3">
            {activities.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <div className={cn("rounded-lg p-2 shrink-0", a.iconBg)}>
                    <Icon className={cn("h-4 w-4", a.iconColor)} aria-hidden />
                  </div>
                  <p className="min-w-0 flex-1 text-sm text-ink dark:text-slate-200 truncate">
                    {a.description}
                  </p>
                  <span className="shrink-0 text-xs text-ink-subtle dark:text-slate-500">
                    {a.time}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AnimatedCard>
  );
}