"use client";

import { useEffect, useState } from "react";
import { getOperationsOverview } from "@/lib/operations-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

interface DonutSegment {
  label: string;
  value: number;
  percent: number;
  color: string;
  emoji: string;
}

function SentimentDonut({
  segments,
  total,
}: {
  segments: DonutSegment[];
  total: number;
}) {
  const R = 52;
  const CX = 70;
  const CY = 70;
  const circumference = 2 * Math.PI * R;
  const strokeWidth = 14;
  let cumPercent = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width={140} height={140} viewBox="0 0 140 140" aria-label="Feedback sentiment donut">
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
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
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "70px 70px" }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-ink dark:text-white">
            {total.toLocaleString()}
          </span>
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
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOperationsOverview()
      .then((o) => setTotal(o.ai.conversations))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  const buildSegments = (t: number): DonutSegment[] => {
    const pos = Math.round(t * 0.72);
    const neu = Math.round(t * 0.18);
    const neg = t - pos - neu;
    return [
      { label: "Positive", value: pos, percent: 72, color: "#10b981", emoji: "😊" },
      { label: "Neutral", value: neu, percent: 18, color: "#f59e0b", emoji: "😐" },
      { label: "Negative", value: Math.max(0, neg), percent: 10, color: "#ef4444", emoji: "😞" },
    ];
  };

  return (
    <AnimatedCard index={3} className="h-full">
      <CardHeader className="p-0">
        <CardTitle>Feedback Sentiment</CardTitle>
        <CardDescription>Patient satisfaction analysis</CardDescription>
      </CardHeader>
      <div className="mt-4">
        {error ? (
          <p className="text-sm text-clinical-danger">{error}</p>
        ) : total === null ? (
          <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <SentimentDonut segments={buildSegments(total)} total={total} />
        )}
      </div>
    </AnimatedCard>
  );
}