"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  label: string;
  icon: LucideIcon;
}

interface WorkflowRibbonProps {
  steps: WorkflowStep[];
  activeIndex?: number;
  className?: string;
  compact?: boolean;
}

export function WorkflowRibbon({
  steps,
  activeIndex = 0,
  className,
  compact = false,
}: WorkflowRibbonProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/60 p-2 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/50",
        className
      )}
    >
      <div className="flex min-w-max items-center gap-1.5 sm:gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;
          return (
            <div key={step.label} className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs",
                  isActive &&
                    "bg-brand-500/15 text-brand-700 ring-1 ring-brand-500/30 dark:bg-brand-500/20 dark:text-brand-200",
                  isPast && "text-slate-500 dark:text-slate-400",
                  !isActive && !isPast && "text-slate-500 dark:text-slate-500"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {!compact && <span className="whitespace-nowrap">{step.label}</span>}
              </span>
              {idx < steps.length - 1 && (
                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
