"use client";

import { motion } from "framer-motion";
import { History, Trash2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHistoryEntry } from "@/lib/places-types";
import { CATEGORY_META } from "@/lib/places-types";
import { deleteSearchHistory, formatDistance } from "@/lib/places-api";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface SearchHistorySidebarProps {
  history: SearchHistoryEntry[];
  onRefresh: () => void;
  onReplay: (entry: SearchHistoryEntry) => void;
  className?: string;
}

export function SearchHistorySidebar({
  history,
  onRefresh,
  onReplay,
  className,
}: SearchHistorySidebarProps) {
  async function handleDelete(id: string) {
    try {
      await deleteSearchHistory(id);
      onRefresh();
    } catch {
      // ignore
    }
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/80",
        className
      )}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-brand-600" aria-hidden />
          <h2 className="text-sm font-semibold text-ink dark:text-white">Recent searches</h2>
        </div>
        <p className="mt-1 text-xs text-ink-muted dark:text-slate-400">Your recent Find Care searches</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {history.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-ink-muted">
            Your recent healthcare place searches will appear here.
          </p>
        ) : (
          <ul className="space-y-1">
            {history.map((entry, i) => (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group flex items-start gap-2 rounded-xl px-2 py-1 hover:bg-brand-50"
              >
                <button
                  type="button"
                  onClick={() => onReplay(entry)}
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-lg px-1 py-1.5 text-left"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {CATEGORY_META[entry.category].plural}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {entry.locationLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {formatDistance(entry.radius)} radius · {entry.resultCount} results ·{" "}
                      {formatRelativeTime(entry.createdAt)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  className="shrink-0 rounded-lg p-1.5 opacity-0 hover:bg-red-50 hover:text-clinical-danger group-hover:opacity-100"
                  aria-label="Delete search"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
