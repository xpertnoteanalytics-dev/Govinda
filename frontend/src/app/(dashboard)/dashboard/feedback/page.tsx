"use client";

import { useEffect, useState } from "react";

const sentimentConfig: Record<string, { label: string; classes: string }> = {
  positive: {
    label: "Positive",
    classes: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  negative: {
    label: "Negative",
    classes: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
  neutral: {
    label: "Neutral",
    classes: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

const sourceConfig: Record<string, { emoji: string; classes: string }> = {
  email:    { emoji: "✉", classes: "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  whatsapp: { emoji: "💬", classes: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" },
  call:     { emoji: "📞", classes: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
};

const accentColors = ["#378ADD", "#1D9E75", "#7F77DD", "#D85A30", "#D4537E"];

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filter, setFilter]             = useState<string>("all");

  useEffect(() => {
    fetch("/api/proxy/v1/feedback")
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((data) => setFeedbackList(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === "all"
      ? feedbackList
      : feedbackList.filter((f) => f.sentiment === filter);

  const count = (s: string) =>
    feedbackList.filter((f) => f.sentiment === s).length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading feedback...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Feedback
        </h1>
        <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full border">
          {feedbackList.length} total
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",    value: feedbackList.length,  color: "" },
          { label: "Positive", value: count("positive"),    color: "text-emerald-600" },
          { label: "Neutral",  value: count("neutral"),     color: "text-zinc-500" },
          { label: "Negative", value: count("negative"),    color: "text-red-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-medium ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["all", "positive", "neutral", "negative"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors capitalize ${
              filter === tab
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No feedback found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((fb, index) => {
            const sentiment = sentimentConfig[fb.sentiment] ?? sentimentConfig["neutral"];
            const src       = sourceConfig[fb.source] ?? { emoji: "📋", classes: "bg-muted text-muted-foreground" };

            return (
              <div
                key={index}
                className="relative bg-white dark:bg-zinc-900 rounded-xl border border-border/60 p-4 overflow-hidden"
              >
                {/* Left accent */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: accentColors[index % accentColors.length] }}
                />

                <div className="pl-3 space-y-3">

                  {/* Patient name + sentiment */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[15px]">
                        {fb.patientName || "Anonymous"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fb.createdAt
                          ? new Date(fb.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })
                          : "No date"}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${sentiment.classes}`}>
                      {sentiment.label}
                    </span>
                  </div>

                  {/* Feedback text */}
                  {fb.feedback && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      "{fb.feedback}"
                    </p>
                  )}

                  {/* Source badge */}
                  <div className="flex gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${src.classes}`}>
                      {src.emoji} {fb.source || "unknown"}
                    </span>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}