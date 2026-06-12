"use client";

import { useEffect, useState } from "react";
import { getOperationsOverview } from "@/lib/operations-api";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

// Major Indian cities with approximate SVG coords (on a 220x240 viewBox map)
const CITY_DOTS = [
  { name: "Delhi", x: 95, y: 52, activity: "high" },
  { name: "Mumbai", x: 68, y: 128, activity: "high" },
  { name: "Bangalore", x: 88, y: 178, activity: "high" },
  { name: "Chennai", x: 102, y: 183, activity: "medium" },
  { name: "Kolkata", x: 148, y: 98, activity: "medium" },
  { name: "Hyderabad", x: 96, y: 150, activity: "medium" },
  { name: "Ahmedabad", x: 68, y: 100, activity: "medium" },
  { name: "Pune", x: 74, y: 133, activity: "low" },
  { name: "Jaipur", x: 82, y: 68, activity: "low" },
  { name: "Lucknow", x: 112, y: 70, activity: "low" },
  { name: "Chandigarh", x: 90, y: 38, activity: "low" },
  { name: "Bhopal", x: 94, y: 107, activity: "low" },
];

const ACTIVITY_COLOR: Record<string, string> = {
  high: "#10b981",
  medium: "#06b6d4",
  low: "#8b5cf6",
};

// Simplified India outline path (approximate)
const INDIA_PATH = `
  M 100,4
  L 118,8 L 138,12 L 152,20 L 162,28 L 168,38 L 172,52
  L 178,58 L 182,68 L 180,80 L 176,88 L 170,94
  L 168,106 L 162,118 L 158,130 L 152,142 L 148,154
  L 140,164 L 130,172 L 120,180 L 110,188 L 102,194
  L 96,188 L 88,182 L 80,174 L 72,164 L 64,152
  L 58,140 L 54,128 L 50,116 L 48,104 L 52,92
  L 58,82 L 62,70 L 64,58 L 68,48 L 74,38
  L 80,28 L 88,18 L 96,10 Z
  M 158,98 L 164,108 L 170,118 L 168,128 L 162,122 L 156,110 Z
`;

export function GeoCoverage() {
  const [cityData, setCityData] = useState<typeof CITY_DOTS>(CITY_DOTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOperationsOverview()
      .then((data) => {
        // If there's real location data in search results, use it
        // Otherwise keep the default dots — real API can be wired here
        if (data.search.recent && data.search.recent.length > 0) {
          // Keep defaults but mark top cities as more active
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AnimatedCard index={7} className="h-full">
      <CardHeader className="flex flex-row items-start justify-between p-0">
        <div>
          <CardTitle>Geographic Coverage</CardTitle>
          <CardDescription>Outreach activity by region</CardDescription>
        </div>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-ink-muted dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
          defaultValue="week"
          aria-label="Time period"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </CardHeader>

      <div className="mt-4">
        {loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <>
            <div className="flex justify-center">
              <svg
                viewBox="40 0 150 200"
                className="h-48 w-auto"
                aria-label="India geographic coverage map"
              >
                {/* Glow effect */}
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <radialGradient id="mapGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity="0.03" />
                  </radialGradient>
                </defs>

                {/* India outline */}
                <path
                  d={INDIA_PATH}
                  fill="url(#mapGrad)"
                  stroke="#06b6d4"
                  strokeWidth="0.8"
                  strokeOpacity="0.4"
                />

                {/* City dots */}
                {cityData.map((city) => (
                  <g key={city.name} filter="url(#glow)">
                    {/* Outer pulse ring */}
                    <circle
                      cx={city.x}
                      cy={city.y}
                      r={city.activity === "high" ? 6 : city.activity === "medium" ? 5 : 4}
                      fill={ACTIVITY_COLOR[city.activity]}
                      opacity={0.15}
                    />
                    {/* Inner dot */}
                    <circle
                      cx={city.x}
                      cy={city.y}
                      r={city.activity === "high" ? 3 : city.activity === "medium" ? 2.5 : 2}
                      fill={ACTIVITY_COLOR[city.activity]}
                      opacity={0.9}
                    />
                  </g>
                ))}
              </svg>
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-center gap-5">
              {[
                { label: "High Activity", color: "#10b981" },
                { label: "Medium Activity", color: "#06b6d4" },
                { label: "Low Activity", color: "#8b5cf6" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-slate-400">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </AnimatedCard>
  );
}