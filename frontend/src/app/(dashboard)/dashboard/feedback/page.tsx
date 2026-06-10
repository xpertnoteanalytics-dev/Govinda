// src/app/(dashboard)/dashboard/feedback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { fetchFeedback, computeStats, type Feedback } from "@/lib/feedback-api";
import SentimentDonut from "@/components/feedback/SentimentDonut";
import TrendChart from "@/components/feedback/TrendChart";
import SatisfactionGauge from "@/components/feedback/SatisfactionGauge";

const sentimentConfig = {
  positive: { label: "Positive", classes: "bg-emerald-500/15 text-emerald-300" },
  negative: { label: "Negative", classes: "bg-red-500/15 text-red-300" },
  neutral:  { label: "Neutral",  classes: "bg-slate-500/15 text-slate-300" },
};

const sourceConfig: Record<string, { emoji: string; classes: string }> = {
  email:    { emoji: "✉",  classes: "bg-violet-500/15 text-violet-300" },
  whatsapp: { emoji: "💬", classes: "bg-emerald-500/15 text-emerald-300" },
  call:     { emoji: "📞", classes: "bg-blue-500/15 text-blue-300" },
  ai_chat:  { emoji: "🤖", classes: "bg-brand-500/15 text-brand-300" },
};

const accentColors = [
  { bg: "bg-blue-500/15",    border: "border-blue-500/30",    dot: "bg-blue-400" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  { bg: "bg-violet-500/15",  border: "border-violet-500/30",  dot: "bg-violet-400" },
  { bg: "bg-orange-500/15",  border: "border-orange-500/30",  dot: "bg-orange-400" },
  { bg: "bg-pink-500/15",    border: "border-pink-500/30",    dot: "bg-pink-400" },
];

const AI_INSIGHTS = [
  { icon: "🔍", title: "Top Concern",       desc: "Wait times and service delays are the most common negative topics." },
  { icon: "💡", title: "Opportunity",       desc: "Patients appreciate staff friendliness — leverage this in outreach." },
  { icon: "📈", title: "Trend",             desc: "Positive feedback increasing week-over-week." },
  { icon: "⚠️", title: "Watch",             desc: "Negative spikes on Mondays — consider staffing adjustments." },
];

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filter, setFilter]             = useState<string>("all");

  useEffect(() => {
    fetchFeedback()
      .then(setFeedbackList)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const stats = computeStats(feedbackList);

  const filtered =
    filter === "all"
      ? feedbackList
      : feedbackList.filter((f) => f.sentiment === filter);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="ops-skeleton h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="ops-section text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ops-page-title flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback Intelligence
          </h1>
          <p className="ops-page-subtitle">Sentiment analysis and patient insights</p>
        </div>
        <span className="ops-stat-pill text-xs text-slate-300">
          {feedbackList.length} responses
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Feedback",  value: stats.total,            sub: "All responses",        color: "text-white" },
          { label: "Positive",        value: `${stats.positivePercent}%`, sub: `${stats.positive} responses`, color: "text-emerald-400" },
          { label: "Neutral",         value: `${stats.neutralPercent}%`,  sub: `${stats.neutral} responses`,  color: "text-slate-300" },
          { label: "Negative",        value: `${stats.negativePercent}%`, sub: `${stats.negative} responses`, color: "text-red-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="ops-section py-4">
            <p className="text-xs text-slate-400 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Sentiment Donut */}
        <div className="ops-section flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-slate-300 self-start">Sentiment Distribution</p>
          <SentimentDonut
            positive={stats.positive}
            negative={stats.negative}
            neutral={stats.neutral}
            total={stats.total}
          />
        </div>

        {/* Trend Chart */}
        <div className="ops-section">
          <p className="text-sm font-medium text-slate-300 mb-3">Feedback Trend</p>
          <TrendChart data={stats.trend} />
          <div className="flex gap-4 mt-3">
            {[
              { color: "#10b981", label: "Positive" },
              { color: "#6b7280", label: "Neutral" },
              { color: "#ef4444", label: "Negative" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-slate-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Satisfaction Gauge */}
        <div className="ops-section flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-slate-300 self-start">Satisfaction Score</p>
          <SatisfactionGauge score={stats.satisfactionScore} />
          <p className="text-xs text-slate-500 text-center mt-1">
            Based on positive + neutral weighted average
          </p>
        </div>
      </div>

      {/* Key Concerns + AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Key Concerns */}
        <div className="ops-section space-y-3">
          <p className="text-sm font-medium text-slate-300">Key Concerns</p>
          {stats.concerns.length === 0 ? (
            <p className="text-xs text-slate-500">No negative feedback yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.concerns.map((concern, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-400 leading-relaxed">{concern}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="ops-section space-y-3">
          <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <span>🤖</span> AI Insights
          </p>
          <div className="space-y-2">
            {AI_INSIGHTS.map((insight, i) => (
              <div key={i} className="flex gap-3 items-start rounded-xl bg-white/5 px-3 py-2.5">
                <span className="text-base">{insight.icon}</span>
                <div>
                  <p className="text-xs font-medium text-slate-200">{insight.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{insight.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "positive", "neutral", "negative"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors capitalize ${
              filter === tab
                ? "ops-chip-active border-brand-400/40"
                : "ops-chip-inactive"
            }`}
          >
            {tab}
            {tab !== "all" && (
              <span className="ml-1.5 text-xs opacity-60">
                ({feedbackList.filter((f) => f.sentiment === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          No feedback found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((fb, index) => {
            const sentiment = sentimentConfig[fb.sentiment] ?? sentimentConfig.neutral;
            const src = sourceConfig[fb.source ?? ""] ?? { emoji: "📋", classes: "bg-slate-500/15 text-slate-300" };
            const color = accentColors[index % accentColors.length];

            return (
              <div
                key={fb._id ?? index}
                className={`rounded-xl border p-4 space-y-3 ${color.bg} ${color.border}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                    <p className="font-medium text-sm text-white">
                      {fb.patientName || "Anonymous"}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${sentiment.classes}`}>
                    {sentiment.label}
                  </span>
                </div>

                {/* Feedback text */}
                {fb.feedback && (
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    &ldquo;{fb.feedback}&rdquo;
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${src.classes}`}>
                    {src.emoji} {fb.source || "unknown"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {fb.createdAt
                      ? new Date(fb.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short",
                        })
                      : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}