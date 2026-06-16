"use client";

/**
 * ChatLoading.tsx — PATCHED
 *
 * Change: Removed hardcoded "Govinda AI is thinking…"
 *         Now accepts an optional `orgName` prop.
 *         Falls back to "AI Assistant" if no name is provided.
 *         Passed down from ChatWindow which reads it from useAuth().
 */

import { Bot } from "lucide-react";
import { motion } from "framer-motion";

interface ChatLoadingProps {
  orgName?: string;
}

export function ChatLoading({ orgName }: ChatLoadingProps) {
  const label = orgName ? `${orgName} is thinking` : "AI Assistant is thinking";

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-100 to-cyan-100 text-brand-700">
        <Bot className="h-4 w-4" aria-hidden />
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-card">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-brand-400"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{label}…</p>
      </div>
    </div>
  );
}