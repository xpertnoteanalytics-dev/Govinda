"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Phone, ChevronRight, Loader2 } from "lucide-react";
import { getCallAnalytics } from "@/lib/calls-api";
import { cn } from "@/lib/utils";
import { AnimatedCard } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export function RecentCalls() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof getCallAnalytics>> | null>(
    null
  );

  useEffect(() => {
    getCallAnalytics()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AnimatedCard index={4}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      </AnimatedCard>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <AnimatedCard index={4}>
      <CardHeader className="flex flex-row items-start justify-between p-0">
        <div>
          <CardDescription>Recent calls</CardDescription>
          <CardTitle className="mt-1 text-lg">Outreach activity</CardTitle>
        </div>
        <Link
          href="/dashboard/calls"
          className="ops-link"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="ops-stat-pill">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-lg font-bold text-ink dark:text-white">{data.totalCalls}</p>
        </div>
        <div className="ops-stat-pill">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300">{data.completedCalls}</p>
        </div>
        <div className="ops-stat-pill">
          <p className="text-xs text-slate-500">Failed</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-300">{data.failedCalls}</p>
        </div>
      </div>

      {data.recent.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted dark:text-slate-500">
          No calls yet. Use Find Care or the AI assistant to place your first outreach call.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.recent.map((r) => (
            <li
              key={`${r.placeName}-${r.createdAt}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink dark:text-white">{r.placeName}</p>
                  <p className="truncate text-xs text-ink-muted dark:text-slate-500">
                    {r.initiatedBy?.name ? `${r.initiatedBy.name} · ` : ""}
                    {new Date(r.createdAt).toLocaleString()}
                    {r.durationSeconds != null ? ` · ${r.durationSeconds}s` : ""}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  r.status === "completed"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : r.status === "failed"
                      ? "bg-red-500/20 text-red-300"
                      : "bg-brand-500/20 text-brand-200"
                )}
              >
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AnimatedCard>
  );
}
