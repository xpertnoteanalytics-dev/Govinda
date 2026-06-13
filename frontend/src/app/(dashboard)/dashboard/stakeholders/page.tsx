// src/app/(dashboard)/dashboard/stakeholders/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, Upload, Plus, Search, Trash2, RefreshCw,
  TrendingUp, MessageSquare, Building2, Phone, Mail,
} from "lucide-react";
import {
  fetchStakeholders, fetchStakeholderAnalytics, fetchImportHistory,
  deleteStakeholder,
  type Stakeholder, type StakeholderAnalytics, type StakeholderImport,
} from "@/lib/stakeholder-api";
import ImportModal from "@/components/stakeholders/ImportModal";

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  patient:    { bg: "bg-blue-500/15",    text: "text-blue-300",    dot: "bg-blue-400" },
  partner:    { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  employee:   { bg: "bg-violet-500/15",  text: "text-violet-300",  dot: "bg-violet-400" },
  sponsor:    { bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400" },
  vendor:     { bg: "bg-orange-500/15",  text: "text-orange-300",  dot: "bg-orange-400" },
  donor:      { bg: "bg-pink-500/15",    text: "text-pink-300",    dot: "bg-pink-400" },
  government: { bg: "bg-slate-500/15",   text: "text-slate-300",   dot: "bg-slate-400" },
  other:      { bg: "bg-zinc-500/15",    text: "text-zinc-300",    dot: "bg-zinc-400" },
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-emerald-400",
  neutral: "text-slate-400",
  negative: "text-red-400",
};

export default function StakeholdersPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [analytics, setAnalytics] = useState<StakeholderAnalytics | null>(null);
  const [imports, setImports] = useState<StakeholderImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"stakeholders" | "imports" | "analytics">("stakeholders");
  const [showImport, setShowImport] = useState(false);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, aData, iData] = await Promise.all([
        fetchStakeholders({ search: search || undefined, type: typeFilter || undefined }),
        fetchStakeholderAnalytics(),
        fetchImportHistory(),
      ]);
      setStakeholders(sData.stakeholders);
      setTotal(sData.total);
      setAnalytics(aData);
      setImports(iData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this stakeholder?")) return;
    setDeleting(id);
    try {
      await deleteStakeholder(id);
      await load();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="ops-page-title flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            Stakeholder Intelligence
          </h1>
          <p className="ops-page-subtitle">Manage and track all stakeholders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowImport(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-300 hover:bg-white/10 transition-colors">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: analytics.total, icon: Users, color: "text-white" },
            { label: "Interactions", value: analytics.totalInteractions, icon: MessageSquare, color: "text-brand-400" },
            { label: "Positive", value: analytics.sentiments?.positive ?? 0, icon: TrendingUp, color: "text-emerald-400" },
            { label: "Negative", value: analytics.sentiments?.negative ?? 0, icon: TrendingUp, color: "text-red-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="ops-section py-4">
              <p className="text-xs text-slate-400 mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
        {(["stakeholders", "analytics", "imports"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? "bg-brand-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Stakeholders Tab */}
      {activeTab === "stakeholders" && (
        <div className="space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, mobile, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ops-input pl-9 h-10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="ops-input h-10 w-full sm:w-48"
            >
              <option value="">All Types</option>
              {Object.keys(TYPE_COLORS).map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-500">{total} stakeholders total</p>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="ops-skeleton h-20 w-full" />)}
            </div>
          ) : stakeholders.length === 0 ? (
            <div className="ops-section text-center py-16">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No stakeholders found</p>
              <button onClick={() => setShowImport(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600">
                <Upload className="w-4 h-4" /> Import CSV
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {stakeholders.map((s) => {
                const color = TYPE_COLORS[s.stakeholderType] ?? TYPE_COLORS.other;
                return (
                  <div key={s._id} className={`rounded-xl border px-4 py-3 space-y-2 ${color.bg} border-white/10`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                        <p className="font-medium text-sm text-white truncate">{s.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${color.bg} ${color.text} border border-white/10`}>
                          {s.stakeholderType}
                        </span>
                        <button onClick={() => handleDelete(s._id)} disabled={deleting === s._id}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {s.mobile && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Phone className="w-3 h-3" />{s.mobile}
                        </p>
                      )}
                      {s.email && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                          <Mail className="w-3 h-3" />{s.email}
                        </p>
                      )}
                      {s.organizationName && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                          <Building2 className="w-3 h-3" />{s.organizationName}
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-slate-600">
                      Added {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* By Type */}
          <div className="ops-section space-y-3">
            <p className="text-sm font-medium text-slate-300">By Stakeholder Type</p>
            <div className="space-y-2">
              {Object.entries(analytics.byType).map(([type, count]) => {
                const pct = analytics.total ? Math.round((count / analytics.total) * 100) : 0;
                const color = TYPE_COLORS[type] ?? TYPE_COLORS.other;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className={`capitalize ${color.text}`}>{type}</span>
                      <span className="text-slate-400">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5">
                      <div className={`h-full rounded-full ${color.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sentiment */}
          <div className="ops-section space-y-3">
            <p className="text-sm font-medium text-slate-300">Interaction Sentiment</p>
            {analytics.totalInteractions === 0 ? (
              <p className="text-xs text-slate-500">No interactions yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(analytics.sentiments).map(([s, count]) => {
                  const pct = analytics.totalInteractions
                    ? Math.round((count / analytics.totalInteractions) * 100)
                    : 0;
                  return (
                    <div key={s} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={`capitalize ${SENTIMENT_COLORS[s] ?? "text-slate-400"}`}>{s}</span>
                        <span className="text-slate-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full ${s === "positive" ? "bg-emerald-400" : s === "negative" ? "bg-red-400" : "bg-slate-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Imports Tab */}
      {activeTab === "imports" && (
        <div className="ops-section space-y-3">
          <p className="text-sm font-medium text-slate-300">Import History</p>
          {imports.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No imports yet</p>
          ) : (
            <div className="space-y-2">
              {imports.map((imp) => (
                <div key={imp._id} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{imp.fileName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(imp.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-emerald-400">{imp.imported} imported</span>
                    <span className="text-amber-400">{imp.duplicates} duplicates</span>
                    {imp.errors > 0 && <span className="text-red-400">{imp.errors} errors</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={load}
        />
      )}
    </div>
  );
}