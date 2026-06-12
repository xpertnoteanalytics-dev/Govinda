"use client";

import { useEffect, useState } from "react";
import { getCallAnalytics } from "@/lib/calls-api";
import { getEmailAnalytics } from "@/lib/emails-api";
import { getWhatsAppAnalytics } from "@/lib/whatsapp-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

interface DayData {
  day: string;       // "Jun 10"
  dateKey: string;   // "2026-06-10"
  calls: number;
  whatsapp: number;
  emails: number;
}

// Build last 7 days array
function getLast7Days(): { day: string; dateKey: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateKey: d.toISOString().split("T")[0],
      day: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    };
  });
}

function countByDay(
  items: Array<{ createdAt: string }>,
  days: { dateKey: string }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  days.forEach((d) => (map[d.dateKey] = 0));
  items.forEach((item) => {
    const key = new Date(item.createdAt).toISOString().split("T")[0];
    if (map[key] !== undefined) map[key]++;
  });
  return map;
}

function SvgLineChart({ data }: { data: DayData[] }) {
  const W = 480;
  const H = 160;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allVals = data.flatMap((d) => [d.calls, d.whatsapp, d.emails]);
  const maxVal = Math.max(...allVals, 1);

  const xScale = (i: number) =>
    data.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  function points(key: "calls" | "whatsapp" | "emails") {
    return data.map((d, i) => `${xScale(i)},${yScale(d[key])}`).join(" ");
  }

  function areaPath(key: "calls" | "whatsapp" | "emails") {
    const pts = data.map((d, i) => `${xScale(i)},${yScale(d[key])}`).join(" L ");
    const base = `${xScale(data.length - 1)},${PAD.top + innerH} ${xScale(0)},${PAD.top + innerH}`;
    return `M ${pts} L ${base} Z`;
  }

  const series = [
    { key: "calls" as const, stroke: "#06b6d4", fill: "url(#gc)", label: "Calls" },
    { key: "whatsapp" as const, stroke: "#10b981", fill: "url(#gw)", label: "WhatsApp" },
    { key: "emails" as const, stroke: "#8b5cf6", fill: "url(#ge)", label: "Emails" },
  ];

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="w-full overflow-x-auto">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-slate-400">
            <span className="inline-block h-2 w-5 rounded-full" style={{ background: s.stroke }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }} aria-label="Outreach trend">
        <defs>
          {[
            { id: "gc", color: "#06b6d4" },
            { id: "gw", color: "#10b981" },
            { id: "ge", color: "#8b5cf6" },
          ].map(({ id, color }) => (
            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left} y1={yScale(t)}
              x2={PAD.left + innerW} y2={yScale(t)}
              stroke="currentColor" strokeOpacity={0.06} strokeDasharray="3 3"
              className="text-slate-400"
            />
            <text
              x={PAD.left - 6} y={yScale(t) + 4}
              textAnchor="end" fontSize={9}
              fill="currentColor" className="text-slate-500" opacity={0.6}
            >
              {t}
            </text>
          </g>
        ))}

        {/* Areas */}
        {series.map((s) => (
          <path key={`a-${s.key}`} d={areaPath(s.key)} fill={s.fill} />
        ))}

        {/* Lines */}
        {series.map((s) => (
          <polyline
            key={`l-${s.key}`}
            points={points(s.key)}
            fill="none" stroke={s.stroke}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
          />
        ))}

        {/* Dots */}
        {series.map((s) =>
          data.map((d, i) => (
            <circle
              key={`d-${s.key}-${i}`}
              cx={xScale(i)} cy={yScale(d[s.key])}
              r={3} fill={s.stroke} stroke="white" strokeWidth={1.5}
            >
              <title>{d.day}: {d[s.key]} {s.label}</title>
            </circle>
          ))
        )}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={`x-${i}`}
            x={xScale(i)} y={H - 4}
            textAnchor="middle" fontSize={9}
            fill="currentColor" className="text-slate-400" opacity={0.6}
          >
            {d.day}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function OutreachTrendChart() {
  const [chartData, setChartData] = useState<DayData[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const days = getLast7Days();

    Promise.allSettled([
      getCallAnalytics(),
      getEmailAnalytics(),
      getWhatsAppAnalytics(),
    ]).then(([callsRes, emailsRes, waRes]) => {
      const callRecent = callsRes.status === "fulfilled" ? callsRes.value.recent : [];
      const emailRecent = emailsRes.status === "fulfilled" ? emailsRes.value.recent : [];
      const waRecent = waRes.status === "fulfilled" ? waRes.value.recent : [];

      const callsByDay = countByDay(callRecent, days);
      const emailsByDay = countByDay(emailRecent, days);
      const waByDay = countByDay(waRecent, days);

      setChartData(
        days.map((d) => ({
          day: d.day,
          dateKey: d.dateKey,
          calls: callsByDay[d.dateKey] ?? 0,
          whatsapp: waByDay[d.dateKey] ?? 0,
          emails: emailsByDay[d.dateKey] ?? 0,
        }))
      );
    }).catch(() => setError("Failed to load chart data"));
  }, []);

  const isEmpty = chartData?.every(
    (d) => d.calls === 0 && d.whatsapp === 0 && d.emails === 0
  );

  return (
    <AnimatedCard index={1} className="h-full">
      <CardHeader className="p-0">
        <CardTitle>Outreach Overview</CardTitle>
        <CardDescription>
          Calls, WhatsApp & Email — last 7 days
        </CardDescription>
      </CardHeader>
      <div className="mt-4">
        {error && (
          <p className="text-sm text-clinical-danger">{error}</p>
        )}
        {!chartData && !error && (
          <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        )}
        {chartData && isEmpty && (
          <p className="py-8 text-center text-sm text-ink-muted dark:text-slate-400">
            No outreach activity in the last 7 days.
          </p>
        )}
        {chartData && !isEmpty && (
          <SvgLineChart data={chartData} />
        )}
      </div>
    </AnimatedCard>
  );
}