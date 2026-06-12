"use client";

import { useEffect, useState } from "react";
import { listSearchHistory } from "@/lib/places-api";
import type { SearchHistoryEntry } from "@/lib/places-types";
import { CATEGORY_META } from "@/lib/places-types";
import { AnimatedCard } from "@/components/ui/motion";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Loader2 } from "lucide-react";

interface MapDot {
  name: string;
  x: number;
  y: number;
  activity: "high" | "medium" | "low";
  count: number;
  category: string;
}

const ACTIVITY_COLOR = {
  high: "#10b981",
  medium: "#06b6d4",
  low: "#8b5cf6",
};

// Convert real lat/lng to SVG x/y within India bounds
// India approx: lat 8–37, lng 68–97
function latLngToSvg(lat: number, lng: number): { x: number; y: number } {
  const svgW = 220;
  const svgH = 220;
  const minLat = 8;
  const maxLat = 37;
  const minLng = 68;
  const maxLng = 97;

  const x = ((lng - minLng) / (maxLng - minLng)) * svgW;
  const y = svgH - ((lat - minLat) / (maxLat - minLat)) * svgH;

  // Clamp within SVG bounds with padding
  return {
    x: Math.min(Math.max(x, 8), svgW - 8),
    y: Math.min(Math.max(y, 8), svgH - 8),
  };
}

function activityLevel(count: number): "high" | "medium" | "low" {
  if (count >= 3) return "high";
  if (count === 2) return "medium";
  return "low";
}

// Simplified India SVG outline path
const INDIA_PATH = `
  M 100,4 L 118,8 L 138,12 L 152,20 L 162,28 L 168,38
  L 172,52 L 178,58 L 182,68 L 180,80 L 176,88 L 170,94
  L 168,106 L 162,118 L 158,130 L 152,142 L 148,154
  L 140,164 L 130,172 L 120,180 L 110,188 L 102,194
  L 96,188 L 88,182 L 80,174 L 72,164 L 64,152
  L 58,140 L 54,128 L 50,116 L 48,104 L 52,92
  L 58,82 L 62,70 L 64,58 L 68,48 L 74,38
  L 80,28 L 88,18 L 96,10 Z
`;

export function GeoCoverage() {
  const [dots, setDots] = useState<MapDot[] | null>(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    listSearchHistory()
      .then((history) => {
        if (!history || history.length === 0) {
          setDots([]);
          return;
        }

        // Filter by period
        const now = new Date();
        const cutoff = new Date();
        if (period === "week") cutoff.setDate(now.getDate() - 7);
        else cutoff.setMonth(now.getMonth() - 1);

        const filtered = history.filter(
          (h) => new Date(h.createdAt) >= cutoff
        );

        if (filtered.length === 0) {
          // Fall back to all history if nothing in period
          buildDots(history);
          return;
        }

        buildDots(filtered);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));

    function buildDots(entries: SearchHistoryEntry[]) {
      // Group by approximate location (round lat/lng to 1 decimal)
      const locationMap: Record<
        string,
        { lat: number; lng: number; label: string; count: number; category: string }
      > = {};

      entries.forEach((h) => {
        const key = `${h.lat.toFixed(1)}_${h.lng.toFixed(1)}`;
        if (!locationMap[key]) {
          locationMap[key] = {
            lat: h.lat,
            lng: h.lng,
            label: h.locationLabel || h.city || "Unknown",
            count: 0,
            category: h.category,
          };
        }
        locationMap[key].count++;
      });

      const result: MapDot[] = Object.values(locationMap).map((loc) => {
        const { x, y } = latLngToSvg(loc.lat, loc.lng);
        return {
          name: loc.label,
          x,
          y,
          activity: activityLevel(loc.count),
          count: loc.count,
          category:
            CATEGORY_META[loc.category as keyof typeof CATEGORY_META]?.label ??
            loc.category,
        };
      });

      setDots(result);
    }
  }, [period]);

  return (
    <AnimatedCard index={7} className="h-full">
      <CardHeader className="flex flex-row items-start justify-between p-0">
        <div>
          <CardTitle>Geographic Coverage</CardTitle>
          <CardDescription>Outreach activity by region</CardDescription>
        </div>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-ink-muted dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
          value={period}
          onChange={(e) => setPeriod(e.target.value as "week" | "month")}
          aria-label="Time period"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </CardHeader>

      <div className="mt-4">
        {!dots && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          </div>
        )}

        {error && (
          <p className="text-sm text-clinical-danger">{error}</p>
        )}

        {dots && dots.length === 0 && (
          <p className="text-sm text-ink-muted dark:text-slate-400">
            No search activity yet. Use Find Care to search locations.
          </p>
        )}

        {dots && dots.length > 0 && (
          <>
            <div className="flex justify-center">
              <svg
                viewBox="40 0 150 210"
                className="h-48 w-auto"
                aria-label="India geographic coverage map"
              >
                <defs>
                  <filter id="geo-glow">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <radialGradient id="mapBg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.07" />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity="0.02" />
                  </radialGradient>
                </defs>

                {/* India outline */}
                <path
                  d={INDIA_PATH}
                  fill="url(#mapBg)"
                  stroke="#06b6d4"
                  strokeWidth="0.8"
                  strokeOpacity="0.35"
                />

                {/* Real location dots */}
                {dots.map((dot, i) => (
                  <g key={i} filter="url(#geo-glow)">
                    {/* Pulse ring */}
                    <circle
                      cx={dot.x}
                      cy={dot.y}
                      r={dot.activity === "high" ? 7 : dot.activity === "medium" ? 5 : 4}
                      fill={ACTIVITY_COLOR[dot.activity]}
                      opacity={0.15}
                    />
                    {/* Core dot */}
                    <circle
                      cx={dot.x}
                      cy={dot.y}
                      r={dot.activity === "high" ? 3.5 : dot.activity === "medium" ? 2.5 : 2}
                      fill={ACTIVITY_COLOR[dot.activity]}
                      opacity={0.9}
                    />
                    {/* Tooltip via title */}
                    <title>{dot.name} — {dot.category} ({dot.count} search{dot.count > 1 ? "es" : ""})</title>
                  </g>
                ))}
              </svg>
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center justify-center gap-4">
              {[
                { label: "High", color: "#10b981" },
                { label: "Medium", color: "#06b6d4" },
                { label: "Low", color: "#8b5cf6" },
              ].map((l) => (
                <span
                  key={l.label}
                  className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-slate-400"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Location list */}
            <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
              {dots
                .sort((a, b) => b.count - a.count)
                .slice(0, 4)
                .map((dot, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-1.5 text-ink-muted dark:text-slate-400 truncate">
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: ACTIVITY_COLOR[dot.activity] }}
                      />
                      {dot.name}
                    </span>
                    <span className="shrink-0 text-ink-subtle dark:text-slate-500">
                      {dot.count} search{dot.count > 1 ? "es" : ""}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </AnimatedCard>
  );
}