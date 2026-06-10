// src/components/feedback/SatisfactionGauge.tsx
"use client";

interface Props {
  score: number; // 0-100
}

export default function SatisfactionGauge({ score }: Props) {
  const r = 60;
  const cx = 80;
  const cy = 80;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;
  const scoreAngle = startAngle + (score / 100) * totalAngle;

  function polar(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function arcPath(start: number, end: number, rad: number) {
    const s = polar(start, rad);
    const e = polar(end, rad);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rad} ${rad} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const needle = polar(scoreAngle, r - 10);
  const color =
    score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={160} height={110} viewBox="0 0 160 110">
        {/* Background arc */}
        <path
          d={arcPath(startAngle, endAngle, r)}
          fill="none"
          stroke="#1e293b"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={arcPath(startAngle, scoreAngle, r)}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="white" />
        {/* Score text */}
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize={20} fontWeight="bold" fill="white">
          {score}
        </text>
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize={8} fill="#64748b">
          / 100
        </text>
      </svg>
      <span
        className="text-xs font-medium px-3 py-1 rounded-full"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {score >= 70 ? "Good" : score >= 40 ? "Average" : "Needs Improvement"}
      </span>
    </div>
  );
}