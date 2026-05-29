"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { getOperationsOverview } from "@/lib/operations-api";
import { cn } from "@/lib/utils";
import { AnimatedCard } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const channelIcon = {
  email: Mail,
  whatsapp: MessageCircle,
  call: Phone,
} as const;

const channelColor = {
  email: "text-sky-400",
  whatsapp: "text-emerald-400",
  call: "text-brand-400",
} as const;

export function RecentOutreach() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getOperationsOverview>>["outreach"] | null
  >(null);

  useEffect(() => {
    getOperationsOverview()
      .then((o) => setData(o.outreach))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AnimatedCard index={5}>
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
    <AnimatedCard index={5}>
      <CardHeader className="flex flex-row items-start justify-between p-0">
        <div>
          <CardDescription>Communication history</CardDescription>
          <CardTitle className="mt-1 text-lg">Recent outreach</CardTitle>
        </div>
        <Link
          href="/dashboard/outreach"
          className="ops-link"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Combined", value: data.combined },
          { label: "Emails", value: data.totalEmails },
          { label: "WhatsApp", value: data.totalWhatsApp },
          { label: "Calls", value: data.totalCalls },
        ].map((s) => (
          <div
            key={s.label}
            className="ops-stat-pill"
          >
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-lg font-bold text-ink dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {data.recent.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted dark:text-slate-500">
          No outreach yet. Use Find Care to email, message, or call healthcare facilities.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.recent.map((r, i) => {
            const Icon = channelIcon[r.channel];
            return (
              <li
                key={`${r.channel}-${r.placeName}-${r.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={cn("h-4 w-4 shrink-0", channelColor[r.channel])} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink dark:text-white">{r.placeName}</p>
                    <p className="truncate text-xs text-ink-muted dark:text-slate-500">
                      {r.channel}
                      {r.detail ? ` · ${r.detail}` : ""}
                      {r.initiatedBy?.name ? ` · ${r.initiatedBy.name}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                  {r.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AnimatedCard>
  );
}
