"use client";

import { useEffect, useState } from "react";
import { getOperationsOverview } from "@/lib/operations-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Loader2 } from "lucide-react";

interface ServiceItem {
  name: string;
  count: number;
  percent: number;
  color: string;
}

const BAR_COLORS = [
  "bg-brand-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-sky-500",
];

const FALLBACK_SERVICES: ServiceItem[] = [
  { name: "Blood Test", count: 468, percent: 100, color: BAR_COLORS[0] },
  { name: "Dental Checkup", count: 312, percent: 67, color: BAR_COLORS[1] },
  { name: "General Consultation", count: 286, percent: 61, color: BAR_COLORS[2] },
  { name: "Health Checkup", count: 182, percent: 39, color: BAR_COLORS[3] },
];

export function TopServices() {
  const [services, setServices] = useState<ServiceItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOperationsOverview()
      .then((data) => {
        const cats = data.search.byCategory;
        if (!cats || cats.length === 0) {
          setServices(FALLBACK_SERVICES);
          return;
        }
        const sorted = [...cats]
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        const max = sorted[0]?.count || 1;
        setServices(
          sorted.map((c, i) => ({
            name: c.category,
            count: c.count,
            percent: Math.round((c.count / max) * 100),
            color: BAR_COLORS[i % BAR_COLORS.length],
          }))
        );
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed");
        setServices(FALLBACK_SERVICES);
      });
  }, []);

  return (
    <AnimatedCard index={5} className="h-full">
      <CardHeader className="p-0">
        <CardTitle>Top Services</CardTitle>
        <CardDescription>Most searched healthcare categories</CardDescription>
      </CardHeader>

      <div className="mt-4">
        {!services && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          </div>
        )}
        {services && (
          <ul className="space-y-4">
            {services.map((s) => (
              <li key={s.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm text-ink dark:text-slate-200">{s.name}</span>
                  <span className="text-sm font-semibold text-ink dark:text-white">
                    {s.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${s.color}`}
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AnimatedCard>
  );
}