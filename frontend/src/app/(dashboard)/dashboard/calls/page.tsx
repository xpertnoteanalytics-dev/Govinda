"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Phone, Loader2, Plus } from "lucide-react";
import { listCalls, getCallAnalytics, type CallRecord } from "@/lib/calls-api";
import { HEALTHCARE_WORKFLOW_STEPS } from "@/lib/workflow-steps";
import { WorkflowRibbon } from "@/components/ui/WorkflowRibbon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CallScriptModal } from "@/components/calls/CallScriptModal";

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalCalls: number;
    successRate: number;
    completedCalls: number;
    failedCalls: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    Promise.all([listCalls(), getCallAnalytics()])
      .then(([c, a]) => {
        setCalls(c);
        setAnalytics({
          totalCalls: a.totalCalls,
          successRate: a.successRate,
          completedCalls: a.completedCalls,
          failedCalls: a.failedCalls,
        });
      })
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="ops-page-title">Calling workflow</h2>
          <p className="ops-page-subtitle">
            Connect with facilities and patients using AI-assisted calls
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="ops-btn-primary flex shrink-0 items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create AI Call
        </button>
      </div>

      <WorkflowRibbon steps={HEALTHCARE_WORKFLOW_STEPS} activeIndex={1} />

      <p className="text-sm text-slate-400">
        Use calls for appointments, sample collection, reminders, and feedback follow-ups.
      </p>

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total calls",   value: analytics.totalCalls    },
            { label: "Completed",     value: analytics.completedCalls },
            { label: "Failed",        value: analytics.failedCalls    },
            { label: "Success rate",  value: `${analytics.successRate}%` },
          ].map((s) => (
            <div key={s.label} className="ops-panel p-4">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      ) : calls.length === 0 ? (
        <div className="ops-panel flex flex-col items-center py-16 text-center">
          <Phone className="h-12 w-12 text-slate-500" />
          <p className="mt-4 font-medium text-slate-200">No calls yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create an AI Call above to get started
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {calls.map((call, i) => (
            <motion.li
              key={call.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="ops-panel p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{call.recipientName}</p>
                  <p className="text-sm text-slate-400">{call.phoneNumber}</p>
                  {call.objectiveType && (
                    <p className="mt-1 text-xs text-brand-300/90 capitalize">
                      {call.objectiveType.replace(/_/g, " ")}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(call.createdAt).toLocaleString()}
                    {call.initiatedBy?.name ? ` · ${call.initiatedBy.name}` : ""}
                    {call.durationSeconds != null ? ` · ${call.durationSeconds}s` : ""}
                  </p>
                </div>
                <StatusBadge status={call.status} />
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <CallScriptModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
