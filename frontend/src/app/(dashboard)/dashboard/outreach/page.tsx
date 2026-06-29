"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail, MessageCircle, Phone,
  Loader2, LayoutGrid, Send, Filter,
} from "lucide-react";
import { listEmails } from "@/lib/emails-api";
import { listWhatsAppMessages } from "@/lib/whatsapp-api";
import { listCalls } from "@/lib/calls-api";
import { HEALTHCARE_WORKFLOW_STEPS } from "@/lib/workflow-steps";
import { WorkflowRibbon } from "@/components/ui/WorkflowRibbon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

type Tab = "all" | "email" | "whatsapp" | "call";

const CATEGORIES = ["All","College","Hospital","NGO","Government","Sponsor","Partner","Corporate","School","Community Organization","Other"];

const accentColors: Record<string, string> = {
  email:    "#378ADD",
  whatsapp: "#1D9E75",
  call:     "#7F77DD",
};

const sourceLabel: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  email:    { icon: Mail,          label: "Email",    color: "text-blue-500" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-emerald-500" },
  call:     { icon: Phone,         label: "Call",     color: "text-violet-500" },
};

export default function OutreachPage() {
  const [tab, setTab]           = useState<Tab>("all");
  const [category, setCategory] = useState("All");
  const [loading, setLoading]   = useState(true);
  const [emails, setEmails]     = useState<Awaited<ReturnType<typeof listEmails>>>([]);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof listWhatsAppMessages>>>([]);
  const [calls, setCalls]       = useState<Awaited<ReturnType<typeof listCalls>>>([]);

  useEffect(() => {
    Promise.all([listEmails(), listWhatsAppMessages(), listCalls()])
      .then(([e, w, c]) => { setEmails(e); setMessages(w); setCalls(c); })
      .catch(() => { setEmails([]); setMessages([]); setCalls([]); })
      .finally(() => setLoading(false));
  }, []);

  // Generic category filter — callers supply which field holds the category value.
  const filterCat = <T extends Record<string, unknown>>(arr: T[], field: keyof T) =>
    category === "All" ? arr : arr.filter(r => r[field] === category);

  const filteredEmails   = filterCat(emails,   "category");
  const filteredMessages = filterCat(messages, "category");
  const filteredCalls    = filterCat(calls,    "recipientCategory");
  const totalActivities  = emails.length + messages.length + calls.length;

  const tabs = [
    { id: "all" as Tab,      label: "All",      icon: LayoutGrid },
    { id: "email" as Tab,    label: "Email",    icon: Mail },
    { id: "whatsapp" as Tab, label: "WhatsApp", icon: MessageCircle },
    { id: "call" as Tab,     label: "Calls",    icon: Phone },
  ];

  function ActivityCard({
    type, name, sub, meta, status, category: cat, index,
  }: {
    type: "email" | "whatsapp" | "call";
    name: string; sub: string; meta: string; status: string; category?: string; index: number;
  }) {
    const src = sourceLabel[type];
    const Icon = src.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="relative bg-white dark:bg-zinc-900 rounded-xl border border-border/60 p-4 overflow-hidden"
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
          style={{ backgroundColor: accentColors[type] }}
        />
        <div className="pl-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn("text-xs font-medium uppercase tracking-wide flex items-center gap-1.5 mb-1", src.color)}>
              <Icon className="w-3.5 h-3.5" /> {src.label}
              {cat && (
                <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground normal-case tracking-normal">
                  {cat}
                </span>
              )}
            </p>
            <p className="font-medium text-[15px] truncate">{name}</p>
            <p className="text-sm text-muted-foreground truncate">{sub}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{meta}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-500" />
          Outreach & care coordination
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calls, WhatsApp, and email activity across all patients
        </p>
      </div>

      {/* Workflow ribbon */}
      <WorkflowRibbon steps={HEALTHCARE_WORKFLOW_STEPS} activeIndex={2} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total activity",    value: totalActivities,                hint: "Calls + WhatsApp + Emails" },
          { label: "Emails",            value: emails.length,                  hint: "Outbound emails sent" },
          { label: "WhatsApp + calls",  value: messages.length + calls.length, hint: "Direct contact" },
        ].map((s) => (
          <div key={s.label} className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-medium">{s.value}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Category filter */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 text-sm px-4 py-1.5 rounded-full border transition-colors",
                tab === t.id
                  ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800"
                  : "text-muted-foreground border-border hover:bg-muted/60"
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}

        <div className="flex items-center gap-1.5 ml-auto">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="text-sm border border-border rounded-full px-3 py-1.5 bg-muted/20 text-foreground"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {(tab === "all" || tab === "email") && filteredEmails.map((row, i) => (
            <ActivityCard key={row.id} type="email" index={i}
              name={row.placeName}
              category={row.category}
              sub={`${row.toEmail} · ${row.subject}`}
              meta={`${new Date(row.createdAt).toLocaleString()}${row.initiatedBy?.name ? ` · ${row.initiatedBy.name}` : ""}`}
              status={row.status} />
          ))}

          {(tab === "all" || tab === "whatsapp") && filteredMessages.map((row, i) => (
            <ActivityCard key={row.id} type="whatsapp" index={i}
              name={row.placeName}
              category={row.category}
              sub={`${row.phoneNumber} · ${row.message}`}
              meta={`${new Date(row.createdAt).toLocaleString()}${row.deliveryStatus ? ` · ${row.deliveryStatus}` : ""}`}
              status={row.status} />
          ))}

          {(tab === "all" || tab === "call") && filteredCalls.map((row, i) => (
            <ActivityCard key={row.id} type="call" index={i}
              name={row.recipientName}
              category={row.recipientCategory}
              sub={row.phoneNumber}
              meta={new Date(row.createdAt).toLocaleString()}
              status={row.status} />
          ))}

          {((tab === "email" && filteredEmails.length === 0) ||
            (tab === "whatsapp" && filteredMessages.length === 0) ||
            (tab === "call" && filteredCalls.length === 0) ||
            (tab === "all" && filteredEmails.length + filteredMessages.length + filteredCalls.length === 0)) && (
            <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No outreach activity yet. Start from Find Care.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
