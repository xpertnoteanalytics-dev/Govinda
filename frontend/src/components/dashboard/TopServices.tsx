"use client";

import { useEffect, useState } from "react";
import { listSearchHistory } from "@/lib/places-api";
import { CATEGORY_META } from "@/lib/places-types";
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

export function TopServices() {
  const [services, setServices] = useState<ServiceItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listSearchHistory()
      .then((history) => {
        if (!history || history.length === 0) {
          setServices([]);
          return;
        }

        // Count searches per category
        const countMap: Record<string, number> = {};
        history.forEach((entry) => {
          const cat = entry.category;
          countMap[cat] = (countMap[cat] ?? 0) + 1;
        });

        const sorted = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const max = sorted[0]?.[1] ?? 1;

        setServices(
          sorted.map(([cat, count], i) => ({
            name: CATEGORY_META[cat as keyof typeof CATEGORY_META]?.label ?? cat,
            count,
            percent: Math.round((count / max) * 100),
            color: BAR_COLORS[i % BAR_COLORS.length],
          }))
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
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

        {error && (
          <p className="text-sm text-clinical-danger">{error}</p>
        )}

        {services && services.length === 0 && (
          <p className="text-sm text-ink-muted dark:text-slate-400">
            No search history yet. Use Find Care to search for healthcare facilities.
          </p>
        )}

        {services && services.length > 0 && (
          <ul className="space-y-4">
            {services.map((s) => (
              <li key={s.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm text-ink dark:text-slate-200">{s.name}</span>
                  <span className="text-sm font-semibold text-ink dark:text-white">
                    {s.count}
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