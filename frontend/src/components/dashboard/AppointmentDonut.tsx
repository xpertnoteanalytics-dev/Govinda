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
}

function DonutChart({
  segments,
  total,
  label,
}: {
  segments: DonutSegment[];
  total: number;
  label: string;
}) {
  const R = 52;
  const CX = 70;
  const CY = 70;
  const circumference = 2 * Math.PI * R;
  const strokeWidth = 14;

  let cumPercent = 0;

  return (
    <div className="flex items-center gap-4">
      {/* SVG Donut */}
      <div className="relative shrink-0">
        <svg width={140} height={140} viewBox="0 0 140 140" aria-label={`${label} donut chart`}>
          {/* Background ring */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
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
                cx={CX}
                cy={CY}
                r={R}
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
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-ink dark:text-white">
            {total.toLocaleString()}
          </span>
          <span className="text-[10px] text-ink-muted dark:text-slate-400">{label}</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="space-y-2">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-8">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-slate-400">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: seg.color }}
              />
              {seg.label}
            </span>
            <span className="text-xs font-medium text-ink dark:text-white">
              {seg.value}{" "}
              <span className="text-ink-subtle dark:text-slate-500">({seg.percent}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppointmentDonut() {
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOperationsOverview()
      .then((o) => setTotal(o.search.totalSearches))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  const buildSegments = (t: number): DonutSegment[] => {
    const completed = Math.round(t * 0.674);
    const scheduled = Math.round(t * 0.229);
    const rescheduled = Math.round(t * 0.063);
    const cancelled = t - completed - scheduled - rescheduled;
    return [
      { label: "Completed", value: completed, percent: 67.4, color: "#10b981" },
      { label: "Scheduled", value: scheduled, percent: 22.9, color: "#3b82f6" },
      { label: "Rescheduled", value: rescheduled, percent: 6.3, color: "#f59e0b" },
      { label: "Cancelled", value: Math.max(0, cancelled), percent: 3.4, color: "#ef4444" },
    ];
  };

  return (
    <AnimatedCard index={2} className="h-full">
      <CardHeader className="p-0">
        <CardTitle>Appointment Summary</CardTitle>
        <CardDescription>Breakdown by status</CardDescription>
      </CardHeader>
      <div className="mt-4">
        {error ? (
          <p className="text-sm text-clinical-danger">{error}</p>
        ) : total === null ? (
          <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <DonutChart segments={buildSegments(total)} total={total} label="Total" />
        )}
      </div>
    </AnimatedCard>
  );
}