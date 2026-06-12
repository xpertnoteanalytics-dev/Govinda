"use client";

import { useEffect, useState } from "react";
import { fetchFeedback, computeStats } from "@/lib/feedback-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

interface Segment {
  label: string;
  value: number;
  percent: number;
  color: string;
  emoji: string;
}

function SentimentDonut({ segments, total }: { segments: Segment[]; total: number }) {
  const R = 52;
  const CX = 70;
  const CY = 70;
  const circumference = 2 * Math.PI * R;
  let cumPercent = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width={140} height={140} viewBox="0 0 140 140" aria-label="Feedback sentiment donut chart">
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={14}
            className="text-slate-100 dark:text-slate-800"
          />
          {segments.map((seg, i) => {
            const dash = (seg.percent / 100) * circumference;
            const gap = circumference - dash;
            const offset = circumference - (cumPercent / 100) * circumference;
            cumPercent += seg.percent;
            return (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={14}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "70px 70px" }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-ink dark:text-white">{total}</span>
          <span className="text-[10px] text-ink-muted dark:text-slate-400">Total</span>
        </div>
      </div>

      <ul className="space-y-2.5">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-slate-400">
              <span className="text-sm">{seg.emoji}</span>
              {seg.label}
            </span>
            <span className="text-xs font-medium text-ink dark:text-white">
              {seg.percent}%{" "}
              <span className="text-ink-subtle dark:text-slate-500">({seg.value})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeedbackDonut() {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFeedback()
      .then((data) => {
        const stats = computeStats(data);
        setTotal(stats.total);
        setSegments([
          {
            label: "Positive",
            value: stats.positive,
            percent: stats.positivePercent,
            color: "#10b981",
            emoji: "😊",
          },
          {
            label: "Neutral",
            value: stats.neutral,
            percent: stats.neutralPercent,
            color: "#f59e0b",
            emoji: "😐",
          },
          {
            label: "Negative",
            value: stats.negative,
            percent: stats.negativePercent,
            color: "#ef4444",
            emoji: "😞",
          },
        ].filter((s) => s.value > 0));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <AnimatedCard index={3} className="h-full">
      <CardHeader className="p-0">
        <CardTitle>Feedback Sentiment</CardTitle>
        <CardDescription>Patient satisfaction analysis</CardDescription>
      </CardHeader>
      <div className="mt-4">
        {error ? (
          <p className="text-sm text-clinical-danger">{error}</p>
        ) : segments === null ? (
          <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : total === 0 ? (
          <p className="text-sm text-ink-muted dark:text-slate-400">No feedback yet.</p>
        ) : (
          <SentimentDonut segments={segments} total={total} />
        )}
      </div>
    </AnimatedCard>
  );
}