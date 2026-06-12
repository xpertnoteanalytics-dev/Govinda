// src/app/(dashboard)/dashboard/feedback/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchFeedback,
  createFeedback,
  computeStats,
  type Feedback,
  type CreateFeedbackPayload,
} from "@/lib/feedback-api";
import SentimentDonut    from "@/components/feedback/SentimentDonut";
import TrendChart        from "@/components/feedback/TrendChart";
import SatisfactionGauge from "@/components/feedback/SatisfactionGauge";

/* ─── static config ───────────────────────────────────────────── */

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
  { icon: "🔍", title: "Top Concern",  desc: "Wait times and service delays are the most common negative topics." },
  { icon: "💡", title: "Opportunity",  desc: "Patients appreciate staff friendliness — leverage this in outreach." },
  { icon: "📈", title: "Trend",        desc: "Positive feedback increasing week-over-week." },
  { icon: "⚠️", title: "Watch",        desc: "Negative spikes on Mondays — consider staffing adjustments." },
];

const EMPTY_FORM: CreateFeedbackPayload = {
  patientName: "",
  feedback: "",
  sentiment: "neutral",
  source: "email",
};

/* ─── Add-Feedback Modal ──────────────────────────────────────── */

function AddFeedbackModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (fb: Feedback) => void;
}) {
  const [form, setForm]       = useState<CreateFeedbackPayload>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const overlayRef            = useRef<HTMLDivElement>(null);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* close on backdrop click */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSubmit = async () => {
    if (!form.feedback.trim()) {
      setError("Feedback text is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createFeedback(form);
      onSaved(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback.");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-colors";

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl shadow-black/60 overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Add Feedback</p>
              <p className="text-xs text-slate-500">Record a new patient response</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div className="px-5 py-4 space-y-4">

          {/* Patient name */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">
              Patient Name <span className="text-slate-600">(optional)</span>
            </label>
            <input
              className={field}
              placeholder="e.g. Rahul Sharma"
              value={form.patientName ?? ""}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
            />
          </div>

          {/* Feedback text */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">
              Feedback <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              className={`${field} resize-none`}
              placeholder="What did the patient say?"
              value={form.feedback}
              onChange={(e) => setForm({ ...form, feedback: e.target.value })}
            />
          </div>

          {/* Sentiment + Source row */}
          <div className="grid grid-cols-2 gap-3">

            {/* Sentiment */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Sentiment</label>
              <div className="flex flex-col gap-1.5">
                {(["positive", "neutral", "negative"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, sentiment: s })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs capitalize transition-colors ${
                      form.sentiment === s
                        ? s === "positive"
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                          : s === "negative"
                          ? "border-red-500/50 bg-red-500/15 text-red-300"
                          : "border-slate-500/50 bg-slate-500/15 text-slate-300"
                        : "border-white/8 bg-white/3 text-slate-500 hover:text-slate-300 hover:border-white/15"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      s === "positive" ? "bg-emerald-400" : s === "negative" ? "bg-red-400" : "bg-slate-400"
                    }`} />
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Source</label>
              <div className="flex flex-col gap-1.5">
                {(["email", "whatsapp", "call", "ai_chat"] as const).map((src) => {
                  const cfg = sourceConfig[src];
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setForm({ ...form, source: src })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                        form.source === src
                          ? `${cfg.classes} border-current/30`
                          : "border-white/8 bg-white/3 text-slate-500 hover:text-slate-300 hover:border-white/15"
                      }`}
                    >
                      <span>{cfg.emoji}</span>
                      <span>{src === "ai_chat" ? "AI Chat" : src.charAt(0).toUpperCase() + src.slice(1)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/8 bg-white/2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {saving ? "Saving…" : "Save Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filter, setFilter]             = useState<string>("all");
  const [showModal, setShowModal]       = useState(false);

  useEffect(() => {
    fetchFeedback()
      .then(setFeedbackList)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  /* prepend the new entry so it appears at top instantly */
  const handleSaved = (fb: Feedback) => {
    setFeedbackList((prev) => [fb, ...prev]);
  };

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
    <>
      {showModal && (
        <AddFeedbackModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      <div className="p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="ops-page-title flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Feedback Intelligence
            </h1>
            <p className="ops-page-subtitle">Sentiment analysis and patient insights</p>
          </div>

          {/* ── Add Feedback button ── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-900/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Feedback
            </button>
            <span className="ops-stat-pill text-xs text-slate-300">
              {feedbackList.length} responses
            </span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Feedback",  value: stats.total,                  sub: "All responses",          color: "text-white" },
            { label: "Positive",        value: `${stats.positivePercent}%`,  sub: `${stats.positive} responses`,  color: "text-emerald-400" },
            { label: "Neutral",         value: `${stats.neutralPercent}%`,   sub: `${stats.neutral} responses`,   color: "text-slate-300" },
            { label: "Negative",        value: `${stats.negativePercent}%`,  sub: `${stats.negative} responses`,  color: "text-red-400" },
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
          <div className="ops-section flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-slate-300 self-start">Sentiment Distribution</p>
            <SentimentDonut
              positive={stats.positive}
              negative={stats.negative}
              neutral={stats.neutral}
              total={stats.total}
            />
          </div>
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
              const src       = sourceConfig[fb.source ?? ""] ?? { emoji: "📋", classes: "bg-slate-500/15 text-slate-300" };
              const color     = accentColors[index % accentColors.length];

              return (
                <div
                  key={fb._id ?? index}
                  className={`rounded-xl border p-4 space-y-3 ${color.bg} ${color.border}`}
                >
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

                  {fb.feedback && (
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      &ldquo;{fb.feedback}&rdquo;
                    </p>
                  )}

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
    </>
  );
}