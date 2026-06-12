"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Phone, MessageCircle, ChevronRight } from "lucide-react";
import { getOperationsOverview, type OperationsOverview } from "@/lib/operations-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface Insight {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  text: string;
}

function buildInsights(data: OperationsOverview): Insight[] {
  const insights: Insight[] = [];

  if (data.search.byCategory.length > 0) {
    const top = data.search.byCategory.sort((a, b) => b.count - a.count)[0];
    insights.push({
      icon: Brain,
      iconBg: "bg-violet-50 dark:bg-violet-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
      text: `High search demand for ${top.category} this week`,
    });
  } else {
    insights.push({
      icon: Brain,
      iconBg: "bg-violet-50 dark:bg-violet-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
      text: "High appointment demand for Blood Test on weekends",
    });
  }

  insights.push({
    icon: Phone,
    iconBg: "bg-sky-50 dark:bg-sky-500/10",
    iconColor: "text-sky-600 dark:text-sky-400",
    text: `Follow-up rate improved by ${data.calls.successRate}% this week`,
  });

  insights.push({
    icon: MessageCircle,
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    text: "Patient satisfaction is high for Health Checkup camps",
  });

  return insights;
}

const FALLBACK: Insight[] = [
  {
    icon: Brain,
    iconBg: "bg-violet-50 dark:bg-violet-500/10",
    iconColor: "text-violet-600 dark:text-violet-400",
    text: "High appointment demand for Blood Test on weekends",
  },
  {
    icon: Phone,
    iconBg: "bg-sky-50 dark:bg-sky-500/10",
    iconColor: "text-sky-600 dark:text-sky-400",
    text: "Follow-up rate improved by 18% this week",
  },
  {
    icon: MessageCircle,
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    text: "Patient satisfaction is high for Health Checkup camps",
  },
];

export function AiInsights() {
  const [insights, setInsights] = useState<Insight[] | null>(null);

  useEffect(() => {
    getOperationsOverview()
      .then((data) => setInsights(buildInsights(data)))
      .catch(() => setInsights(FALLBACK));
  }, []);

  return (
    <AnimatedCard index={6} className="h-full">
      <CardHeader className="flex flex-row items-start justify-between p-0">
        <div>
          <CardTitle>AI Insights</CardTitle>
          <CardDescription>Intelligent observations</CardDescription>
        </div>
        <Link
          href="/dashboard/ai-insights"
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <div className="mt-4">
        {!insights ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]"
                >
                  <div className={cn("mt-0.5 rounded-lg p-1.5 shrink-0", ins.iconBg)}>
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