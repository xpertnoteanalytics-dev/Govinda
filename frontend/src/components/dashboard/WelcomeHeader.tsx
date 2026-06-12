"use client";

import { FadeIn } from "@/components/ui/motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { Calendar } from "lucide-react";

function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return `${start.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function WelcomeHeader() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-16 w-full animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-700/40" />;
  }

  return (
    <FadeIn className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink dark:text-white sm:text-2xl">
          Executive Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-slate-400">
          {user
            ? `${user.tenant.name} · Real-time overview of healthcare operations`
            : "Real-time overview of healthcare operations"}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink-muted shadow-card dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
        <Calendar className="h-4 w-4 text-brand-500" aria-hidden />
        {getDateRange()}
      </div>
    </FadeIn>
  );
}