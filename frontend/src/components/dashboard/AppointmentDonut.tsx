"use client";

import { useEffect, useState } from "react";
import { fetchAppointments, type Appointment } from "@/lib/appointments";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

interface Segment {
  label: string;
  value: number;
  percent: number;
  color: string;
}

function DonutChart({ segments, total }: { segments: Segment[]; total: number }) {
  const R = 52;
  const CX = 70;
  const CY = 70;
  const circumference = 2 * Math.PI * R;
  let cumPercent = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width={140} height={140} viewBox="0 0 140 140" aria-label="Appointment summary donut chart">
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
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color }} />
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

function categorize(appointments: Appointment[]): Segment[] {
  const today = new Date();

  let completed = 0;
  let scheduled = 0;
  let rescheduled = 0;
  let cancelled = 0;

  appointments.forEach((a) => {
    // Normalize date
    let apptDate: Date | null = null;
    if (a.appointmentDate) {
      if (a.appointmentDate.includes("/")) {
        const [d, m, y] = a.appointmentDate.split("/");
        apptDate = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
      } else {
        apptDate = new Date(a.appointmentDate);
      }
    }

    if (!apptDate || isNaN(apptDate.getTime())) {
      scheduled++;
      return;
    }

    const isPast = apptDate < new Date(today.toDateString());

    if (isPast) {
      completed++;
    } else {
      scheduled++;
    }
  });

  const total = appointments.length;
  if (total === 0) return [];

  const pct = (n: number) => Math.round((n / total) * 100);

  return [
    { label: "Completed", value: completed, percent: pct(completed), color: "#10b981" },
    { label: "Scheduled", value: scheduled, percent: pct(scheduled), color: "#3b82f6" },
    { label: "Rescheduled", value: rescheduled, percent: pct(rescheduled), color: "#f59e0b" },
    { label: "Cancelled", value: cancelled, percent: pct(cancelled), color: "#ef4444" },
  ].filter((s) => s.value > 0);
}

export function AppointmentDonut() {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAppointments()
      .then((data) => {
        setTotal(data.length);
        setSegments(categorize(data));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <AnimatedCard index={2} className="h-full">
      <CardHeader className="p-0">
        <CardTitle>Appointment Summary</CardTitle>
        <CardDescription>Breakdown by status</CardDescription>
      </CardHeader>
      <div className="mt-4">
        {error ? (
          <p className="text-sm text-clinical-danger">{error}</p>
        ) : segments === null ? (
          <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : total === 0 ? (
          <p className="text-sm text-ink-muted dark:text-slate-400">No appointments yet.</p>
        ) : (
          <DonutChart segments={segments} total={total} />
        )}
      </div>
    </AnimatedCard>
  );
}