// src/lib/feedback-api.ts
import { apiFetch } from "@/lib/api";

export interface Feedback {
  _id: string;
  patientName?: string;
  feedback: string;
  sentiment: "positive" | "negative" | "neutral";
  source?: string;
  createdAt: string;
}

export async function fetchFeedback(): Promise<Feedback[]> {
  return apiFetch<Feedback[]>("/v1/feedback");
}

export function computeStats(list: Feedback[]) {
  const total = list.length;
  const positive = list.filter((f) => f.sentiment === "positive").length;
  const negative = list.filter((f) => f.sentiment === "negative").length;
  const neutral = list.filter((f) => f.sentiment === "neutral").length;
  const positivePercent = total ? Math.round((positive / total) * 100) : 0;
  const negativePercent = total ? Math.round((negative / total) * 100) : 0;
  const neutralPercent = total ? Math.round((neutral / total) * 100) : 0;
  const satisfactionScore = total
    ? Math.round(((positive * 100 + neutral * 50) / total))
    : 0;

  // Group by date for trend
  const trendMap: Record<string, { positive: number; negative: number; neutral: number }> = {};
  list.forEach((f) => {
    const date = new Date(f.createdAt).toLocaleDateString("en-IN", {
      day: "numeric", month: "short",
    });
    if (!trendMap[date]) trendMap[date] = { positive: 0, negative: 0, neutral: 0 };
    trendMap[date][f.sentiment]++;
  });

  const trend = Object.entries(trendMap)
    .slice(-7)
    .map(([date, counts]) => ({ date, ...counts }));

  // Key concerns from negative feedback
  const concerns = list
    .filter((f) => f.sentiment === "negative" && f.feedback)
    .slice(0, 5)
    .map((f) => f.feedback.slice(0, 80));

  return {
    total,
    positive,
    negative,
    neutral,
    positivePercent,
    negativePercent,
    neutralPercent,
    satisfactionScore,
    trend,
    concerns,
  };
}