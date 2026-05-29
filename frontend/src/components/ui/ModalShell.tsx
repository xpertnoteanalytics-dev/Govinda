"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  children,
  size = "md",
}: ModalShellProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "ops-modal flex max-h-[92vh] w-full flex-col overflow-hidden sm:max-h-[90vh] sm:rounded-2xl",
              size === "lg" ? "sm:max-w-xl" : "sm:max-w-lg"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                {Icon && (
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      iconClassName ?? "bg-brand-500/15 text-brand-300"
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-white">{title}</h3>
                  {subtitle && (
                    <p className="truncate text-sm text-slate-400">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ops-icon-btn shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
