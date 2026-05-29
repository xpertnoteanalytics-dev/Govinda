"use client";

import { useEffect, useState } from "react";
import { MapPin, Phone, Sparkles, Activity, Mail, MessageCircle } from "lucide-react";
import { getOperationsOverview, type OperationsOverview } from "@/lib/operations-api";
import { AnimatedCard, StaggerList } from "@/components/ui/motion";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export function OperationsOverview() {
  const [data, setData] = useState<OperationsOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOperationsOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "AI conversations",
      value: String(data.ai.conversations),
      icon: Sparkles,
      sub: "Operational guidance",
    },
    {
      label: "Healthcare searches",
      value: String(data.search.totalSearches),
      icon: MapPin,
      sub: "Find Care activity",
    },
    {
      label: "Emails sent",
      value: String(data.emails.totalEmails),
      icon: Mail,
      sub: `${data.emails.successRate}% delivery success`,
    },
    {
      label: "WhatsApp messages",
      value: String(data.whatsapp.totalMessages),
      icon: MessageCircle,
      sub: `${data.whatsapp.successRate}% delivery success`,
    },
    {
      label: "Outbound calls",
      value: String(data.calls.totalCalls),
      icon: Phone,
      sub: `${data.calls.successRate}% success rate`,
    },
    {
      label: "Activity score",
      value: String(data.activityScore),
      icon: Activity,
      sub: `${data.outreach.combined} total touchpoints`,
    },
  ];

  return (
    <StaggerList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <AnimatedCard key={c.label} index={i}>
            <CardHeader className="mb-0 flex flex-row items-start justify-between p-0">
              <div>
                <CardDescription>{c.label}</CardDescription>
                <CardTitle className="mt-1 text-2xl">{c.value}</CardTitle>
              </div>
              <div className="rounded-xl bg-brand-500/15 p-2.5 text-brand-300">
                <Icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <p className="mt-3 text-xs text-ink-subtle dark:text-slate-500">{c.sub}</p>
          </AnimatedCard>
        );
      })}
    </StaggerList>
  );
}
