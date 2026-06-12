"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, MessageCircle, Users, Calendar, Star, TrendingUp } from "lucide-react";
import { getOperationsOverview, type OperationsOverview } from "@/lib/operations-api";
import { StaggerList } from "@/components/ui/motion";
import { motion } from "framer-motion";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend: string;
  trendUp?: boolean;
  color: string;
  bgColor: string;
  index: number;
}

function KpiCard({ label, value, icon: Icon, trend, trendUp = true, color, bgColor, index }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-white/10 dark:bg-slate-900/60"
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} aria-hidden />
        </div>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            trendUp
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
          }`}
        >
          <TrendingUp className={`h-3 w-3 ${trendUp ? "" : "rotate-180"}`} aria-hidden />
          {trend}
        </span>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight text-ink dark:text-white">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-slate-400">{label}</p>
      </div>
      <p className="mt-1.5 text-xs text-ink-subtle dark:text-slate-500">vs last 7 days</p>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-700/40" />
      ))}
    </div>
  );
}

export function KpiCards() {
  const [data, setData] = useState<OperationsOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOperationsOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-clinical-danger dark:border-red-500/20 dark:bg-red-500/10">
        {error}
      </div>
    );
  }

  if (!data) return <KpiSkeleton />;

  const totalOutreach = data.outreach.combined;

  const kpis: Omit<KpiCardProps, "index">[] = [
    {
      label: "Total Outreach",
      value: totalOutreach,
      icon: Users,
      trend: "15.6%",
      color: "text-brand-600 dark:text-brand-400",
      bgColor: "bg-brand-50 dark:bg-brand-500/10",
    },
    {
      label: "Phone Calls",
      value: data.calls.totalCalls,
      icon: Phone,
      trend: "12.2%",
      color: "text-sky-600 dark:text-sky-400",
      bgColor: "bg-sky-50 dark:bg-sky-500/10",
    },
    {
      label: "WhatsApp Messages",
      value: data.whatsapp.totalMessages,
      icon: MessageCircle,
      trend: "18.7%",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "Emails Sent",
      value: data.emails.totalEmails,
      icon: Mail,
      trend: "11.5%",
      color: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-violet-500/10",
    },
    {
      label: "Appointments",
      value: data.search.totalSearches,
      icon: Calendar,
      trend: "14.8%",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-500/10",
    },
    {
      label: "Feedback Received",
      value: data.ai.conversations,
      icon: Star,
      trend: "16.2%",
      color: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-50 dark:bg-pink-500/10",
    },
  ];

  return (
    <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi, i) => (
        <KpiCard key={kpi.label} {...kpi} index={i} />
      ))}
    </StaggerList>
  );
}