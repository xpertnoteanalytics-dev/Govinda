// src/components/feedback/SentimentDonut.tsx
"use client";

interface Props {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export default function SentimentDonut({ positive, negative, neutral, total }: Props) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: positive, color: "#10b981", label: "Positive" },
    { value: neutral, color: "#6b7280", label: "Neutral" },
    { value: negative, color: "#ef4444", label: "Negative" },
  ];

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = total ? seg.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const arc = { ...seg, dash, gap, offset: -offset * circumference };
    offset += pct;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dasharray 0.5s ease" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-xs text-slate-400">Total</span>
        </div>
      </div>
      <div className="flex gap-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-slate-400">{seg.label}</span>
            <span className="text-xs font-medium text-white">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}