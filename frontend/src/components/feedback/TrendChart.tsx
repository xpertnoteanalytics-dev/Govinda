// src/components/feedback/TrendChart.tsx
"use client";

interface TrendPoint {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
}

interface Props {
  data: TrendPoint[];
}

export default function TrendChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        No trend data yet
      </div>
    );
  }

  const width = 400;
  const height = 120;
  const padX = 30;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const maxVal = Math.max(
    ...data.flatMap((d) => [d.positive, d.negative, d.neutral]),
    1
  );

  function points(key: "positive" | "negative" | "neutral") {
    return data
      .map((d, i) => {
        const x = padX + (i / Math.max(data.length - 1, 1)) * innerW;
        const y = padY + innerH - (d[key] / maxVal) * innerH;
        return `${x},${y}`;
      })
      .join(" ");
  }

  const lines = [
    { key: "positive" as const, color: "#10b981" },
    { key: "neutral" as const, color: "#6b7280" },
    { key: "negative" as const, color: "#ef4444" },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: 200 }}
      >
        {/* Grid lines */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            y1={padY + innerH * t}
            x2={width - padX}
            y2={padY + innerH * t}
            stroke="#1e293b"
            strokeWidth={1}
          />
        ))}

        {/* Lines */}
        {lines.map(({ key, color }) => (
          <polyline
            key={key}
            points={points(key)}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Dots */}
        {lines.map(({ key, color }) =>
          data.map((d, i) => {
            const x = padX + (i / Math.max(data.length - 1, 1)) * innerW;
            const y = padY + innerH - (d[key] / maxVal) * innerH;
            return (
              <circle key={`${key}-${i}`} cx={x} cy={y} r={3} fill={color} />
            );
          })
        )}

        {/* X labels */}
        {data.map((d, i) => {
          const x = padX + (i / Math.max(data.length - 1, 1)) * innerW;
          return (
            <text
              key={i}
              x={x}
              y={height - 2}
              textAnchor="middle"
              fontSize={8}
              fill="#64748b"
            >
              {d.date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}