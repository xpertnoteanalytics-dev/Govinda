"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, MessageCircle, Users, Calendar, Star, TrendingUp, TrendingDown } from "lucide-react";
import { getCallAnalytics } from "@/lib/calls-api";
import { getEmailAnalytics } from "@/lib/emails-api";
import { getWhatsAppAnalytics } from "@/lib/whatsapp-api";
import { fetchAppointments } from "@/lib/appointments";
import { fetchFeedback } from "@/lib/feedback-api";
import { StaggerList } from "@/components/ui/motion";
import { motion } from "framer-motion";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  successRate?: number | null; // real success rate if available
  color: string;
  bgColor: string;
  index: number;
}

function KpiCard({ label, value, icon: Icon, successRate, color, bgColor, index }: KpiCardProps) {
  const hasRate = successRate !== null && successRate !== undefined;
  const isGood = !hasRate || successRate >= 70;

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
        {hasRate && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              isGood
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            }`}
          >
            {isGood
              ? <TrendingUp className="h-3 w-3" aria-hidden />
              : <TrendingDown className="h-3 w-3" aria-hidden />
            }
            {successRate}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight text-ink dark:text-white">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-slate-400">{label}</p>
      </div>
      <p className="mt-1.5 text-xs text-ink-subtle dark:text-slate-500">
        {hasRate ? `${successRate}% success rate` : "vs last 7 days"}
      </p>
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

interface KpiData {
  totalOutreach: number;
  calls: { total: number; successRate: number };
  whatsapp: { total: number; successRate: number };
  emails: { total: number; successRate: number };
  appointments: number;
  feedback: number;
}

export function KpiCards() {
  const [data, setData] = useState<KpiData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      getCallAnalytics(),
      getEmailAnalytics(),
      getWhatsAppAnalytics(),
      fetchAppointments(),
      fetchFeedback(),
    ]).then(([callsRes, emailsRes, waRes, apptRes, feedbackRes]) => {
      const calls = callsRes.status === "fulfilled" ? callsRes.value : null;
      const emails = emailsRes.status === "fulfilled" ? emailsRes.value : null;
      const wa = waRes.status === "fulfilled" ? waRes.value : null;
      const appts = apptRes.status === "fulfilled" ? apptRes.value : [];
      const feedback = feedbackRes.status === "fulfilled" ? feedbackRes.value : [];

      const totalCalls = calls?.totalCalls ?? 0;
      const totalEmails = emails?.totalEmails ?? 0;
      const totalWa = wa?.totalMessages ?? 0;

      setData({
        totalOutreach: totalCalls + totalEmails + totalWa,
        calls: {
          total: totalCalls,
          successRate: calls?.successRate ?? 0,
        },
        whatsapp: {
          total: totalWa,
          successRate: wa?.successRate ?? 0,
        },
        emails: {
          total: totalEmails,
          successRate: emails?.successRate ?? 0,
        },
        appointments: appts.length,
        feedback: feedback.length,
      });
    }).catch(() => setError("Failed to load KPI data"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-clinical-danger dark:border-red-500/20 dark:bg-red-500/10">
        {error}
      </div>
    );
  }

  if (!data) return <KpiSkeleton />;

  return (
    <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        index={0}
        label="Total Outreach"
        value={data.totalOutreach}
        icon={Users}
        successRate={null}
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-500/10"
      />
      <KpiCard
        index={1}
        label="Phone Calls"
        value={data.calls.total}
        icon={Phone}
        successRate={data.calls.total > 0 ? data.calls.successRate : null}
        color="text-sky-600 dark:text-sky-400"
        bgColor="bg-sky-50 dark:bg-sky-500/10"
      />
      <KpiCard
        index={2}
        label="WhatsApp Messages"
        value={data.whatsapp.total}
        icon={MessageCircle}
        successRate={data.whatsapp.total > 0 ? data.whatsapp.successRate : null}
        color="text-emerald-600 dark:text-emerald-400"
        bgColor="bg-emerald-50 dark:bg-emerald-500/10"
      />
      <KpiCard
        index={3}
        label="Emails Sent"
        value={data.emails.total}
        icon={Mail}
        successRate={data.emails.total > 0 ? data.emails.successRate : null}
        color="text-violet-600 dark:text-violet-400"
        bgColor="bg-violet-50 dark:bg-violet-500/10"
      />
      <KpiCard
        index={4}
        label="Appointments"
        value={data.appointments}
        icon={Calendar}
        successRate={null}
        color="text-orange-600 dark:text-orange-400"
        bgColor="bg-orange-50 dark:bg-orange-500/10"
      />
      <KpiCard
        index={5}
        label="Feedback Received"
        value={data.feedback}
        icon={Star}
        successRate={null}
        color="text-pink-600 dark:text-pink-400"
        bgColor="bg-pink-50 dark:bg-pink-500/10"
      />
    </StaggerList>
  );
}