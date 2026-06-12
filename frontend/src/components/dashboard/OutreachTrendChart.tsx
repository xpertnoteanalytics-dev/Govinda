"use client";

import { useEffect, useState, useRef } from "react";
import { getOperationsOverview } from "@/lib/operations-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

// Generate mock trend data from real totals — proportional distribution over 7 days
function buildTrendData(calls: number, whatsapp: number, emails: number) {
  const days = ["May 27", "May 28", "May 29", "May 30", "May 31", "Jun 01", "Jun 02"];
  const weights = [0.10, 0.12, 0.14, 0.16, 0.17, 0.15, 0.16];
  return days.map((day, i) => ({
    day,
    calls: Math.round(calls * weights[i]),
    whatsapp: Math.round(whatsapp * weights[i]),
    emails: Math.round(emails * weights[i]),
  }));
}

function SvgLineChart({
  data,
}: {
  data: { day: string; calls: number; whatsapp: number; emails: number }[];
}) {
  const W = 480;
  const H = 160;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allVals = data.flatMap((d) => [d.calls, d.whatsapp, d.emails]);
  const maxVal = Math.max(...allVals, 1);

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  function polyline(key: "calls" | "whatsapp" | "emails") {
    return data.map((d, i) => `${xScale(i)},${yScale(d[key])}`).join(" ");
  }

  function areaPath(key: "calls" | "whatsapp" | "emails") {
    const pts = data.map((d, i) => `${xScale(i)},${yScale(d[key])}`).join(" L ");
    const base = `${xScale(data.length - 1)},${PAD.top + innerH} ${xScale(0)},${PAD.top + innerH}`;
    return `M ${pts} L ${base} Z`;
  }

  const series = [
    { key: "calls" as const, stroke: "#06b6d4", fill: "url(#grad-calls)", label: "Calls" },
    { key: "whatsapp" as const, stroke: "#10b981", fill: "url(#grad-wa)", label: "WhatsApp" },
    { key: "emails" as const, stroke: "#8b5cf6", fill: "url(#grad-email)", label: "Emails" },
  ];

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="relative w-full overflow-x-auto">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-slate-400">
            <span className="inline-block h-2 w-5 rounded-full" style={{ background: s.stroke }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 280 }}
        aria-label="Outreach trend chart"
      >
        <defs>
          <linearGradient id="grad-calls" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="grad-wa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="grad-email" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={yScale(t)}
              x2={PAD.left + innerW}
              y2={yScale(t)}
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeDasharray="3 3"
              className="text-slate-400"
            />
            <text
              x={PAD.left - 6}
              y={yScale(t) + 4}
              textAnchor="end"
              fontSize={9}
              fill="currentColor"
              className="text-slate-400 dark:text-slate-500"
              opacity={0.6}
            >
              {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}
            </text>
          </g>
        ))}

        {/* Area fills */}
        {series.map((s) => (
          <path key={`area-${s.key}`} d={areaPath(s.key)} fill={s.fill} />
        ))}

        {/* Lines */}
        {series.map((s) => (
          <polyline
            key={`line-${s.key}`}
            points={polyline(s.key)}
            fill="none"
            stroke={s.stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Dots */}
        {series.map((s) =>
          data.map((d, i) => (
            <circle
              key={`dot-${s.key}-${i}`}
              cx={xScale(i)}
              cy={yScale(d[s.key])}
              r={3}
              fill={s.stroke}
              stroke="white"
              strokeWidth={1.5}
            />
          ))
        )}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={`x-${i}`}
            x={xScale(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            fill="currentColor"
            className="text-slate-400"
            opacity={0.6}
          >
            {d.day}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function OutreachTrendChart() {
  const [data, setData] = useState<ReturnType<typeof buildTrendData> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOperationsOverview()
      .then((o) => {
        setData(
          buildTrendData(o.calls.totalCalls, o.whatsapp.totalMessages, o.emails.totalEmails)
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <AnimatedCard index={1} className="h-full">
      <CardHeader className="p-0">
        <CardTitle>Outreach Overview</CardTitle>
        <CardDescription>Calls, WhatsApp & Email activity over 7 days</CardDescription>
      </CardHeader>
      <div className="mt-4">
        {error ? (
          <p className="text-sm text-clinical-danger">{error}</p>
        ) : !data ? (
          <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <SvgLineChart data={data} />
        )}
      </div>
    </AnimatedCard>
  );
}