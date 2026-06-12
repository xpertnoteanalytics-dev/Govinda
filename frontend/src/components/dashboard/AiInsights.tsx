"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Phone, Mail, MessageCircle, Star, ChevronRight, Loader2 } from "lucide-react";
import { getCallAnalytics } from "@/lib/calls-api";
import { getEmailAnalytics } from "@/lib/emails-api";
import { getWhatsAppAnalytics } from "@/lib/whatsapp-api";
import { fetchFeedback, computeStats } from "@/lib/feedback-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface Insight {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  text: string;
}

export function AiInsights() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      getCallAnalytics(),
      getEmailAnalytics(),
      getWhatsAppAnalytics(),
      fetchFeedback(),
    ]).then(([callsRes, emailsRes, waRes, feedbackRes]) => {
      const result: Insight[] = [];

      // --- Calls insight ---
      if (callsRes.status === "fulfilled") {
        const c = callsRes.value;
        if (c.totalCalls === 0) {
          result.push({
            icon: Phone,
            iconBg: "bg-sky-50 dark:bg-sky-500/10",
            iconColor: "text-sky-600 dark:text-sky-400",
            text: "No calls placed yet. Start outreach via Find Care.",
          });
        } else if (c.successRate >= 75) {
          result.push({
            icon: Phone,
            iconBg: "bg-sky-50 dark:bg-sky-500/10",
            iconColor: "text-sky-600 dark:text-sky-400",
            text: `Call success rate is strong at ${c.successRate}% (${c.completedCalls} of ${c.totalCalls} completed).`,
          });
        } else {
          result.push({
            icon: Phone,
            iconBg: "bg-sky-50 dark:bg-sky-500/10",
            iconColor: "text-sky-600 dark:text-sky-400",
            text: `${c.failedCalls} calls failed out of ${c.totalCalls}. Consider reviewing call scripts.`,
          });
        }
      }

      // --- Email insight ---
      if (emailsRes.status === "fulfilled") {
        const e = emailsRes.value;
        if (e.totalEmails === 0) {
          result.push({
            icon: Mail,
            iconBg: "bg-violet-50 dark:bg-violet-500/10",
            iconColor: "text-violet-600 dark:text-violet-400",
            text: "No emails sent yet. Use Find Care to send outreach emails.",
          });
        } else if (e.successRate >= 80) {
          result.push({
            icon: Mail,
            iconBg: "bg-violet-50 dark:bg-violet-500/10",
            iconColor: "text-violet-600 dark:text-violet-400",
            text: `Email delivery is performing well — ${e.successRate}% success rate across ${e.totalEmails} emails.`,
          });
        } else {
          result.push({
            icon: Mail,
            iconBg: "bg-violet-50 dark:bg-violet-500/10",
            iconColor: "text-violet-600 dark:text-violet-400",
            text: `${e.failedEmails} emails failed to deliver. Check recipient addresses.`,
          });
        }
      }

      // --- WhatsApp insight ---
      if (waRes.status === "fulfilled") {
        const w = waRes.value;
        if (w.totalMessages === 0) {
          result.push({
            icon: MessageCircle,
            iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            text: "No WhatsApp messages sent yet. Try messaging facilities directly.",
          });
        } else {
          result.push({
            icon: MessageCircle,
            iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            text: `WhatsApp outreach: ${w.sentMessages} messages sent with ${w.successRate}% delivery rate.`,
          });
        }
      }

      // --- Feedback insight ---
      if (feedbackRes.status === "fulfilled") {
        const stats = computeStats(feedbackRes.value);
        if (stats.total === 0) {
          result.push({
            icon: Star,
            iconBg: "bg-pink-50 dark:bg-pink-500/10",
            iconColor: "text-pink-600 dark:text-pink-400",
            text: "No feedback collected yet. Encourage patients to share their experience.",
          });
        } else if (stats.positivePercent >= 60) {
          result.push({
            icon: Star,
            iconBg: "bg-pink-50 dark:bg-pink-500/10",
            iconColor: "text-pink-600 dark:text-pink-400",
            text: `Patient sentiment is positive — ${stats.positivePercent}% positive out of ${stats.total} responses.`,
          });
        } else if (stats.negativePercent >= 30) {
          result.push({
            icon: Brain,
            iconBg: "bg-orange-50 dark:bg-orange-500/10",
            iconColor: "text-orange-600 dark:text-orange-400",
            text: `${stats.negativePercent}% negative feedback detected. Review recent concerns to improve care.`,
          });
        } else {
          result.push({
            icon: Star,
            iconBg: "bg-pink-50 dark:bg-pink-500/10",
            iconColor: "text-pink-600 dark:text-pink-400",
            text: `${stats.total} feedback responses collected — ${stats.neutralPercent}% neutral, ${stats.positivePercent}% positive.`,
          });
        }
      }

      // Always show at least something
      if (result.length === 0) {
        result.push({
          icon: Brain,
          iconBg: "bg-violet-50 dark:bg-violet-500/10",
          iconColor: "text-violet-600 dark:text-violet-400",
          text: "Start using outreach features to generate AI insights.",
        });
      }

      setInsights(result.slice(0, 3));
    });
  }, []);

  return (
    <AnimatedCard index={6} className="h-full">
      <CardHeader className="flex flex-row items-start justify-between p-0">
        <div>
          <CardTitle>AI Insights</CardTitle>
          <CardDescription>Based on your real activity</CardDescription>
        </div>
        <Link
          href="/dashboard/feedback"
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <div className="mt-4">
        {!insights && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          </div>
        )}

        {error && (
          <p className="text-sm text-clinical-danger">{error}</p>
        )}

        {insights && (
          <ul className="space-y-3">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]"
                >
                  <div className={cn("mt-0.5 shrink-0 rounded-lg p-1.5", ins.iconBg)}>
                    <Icon className={cn("h-3.5 w-3.5", ins.iconColor)} aria-hidden />
                  </div>
                  <p className="text-xs leading-relaxed text-ink-muted dark:text-slate-300">
                    {ins.text}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AnimatedCard>
  );
}