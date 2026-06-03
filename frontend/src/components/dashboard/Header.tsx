"use client";

import Link from "next/link";
import { Bell, Menu, Moon, Sun } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { useTheme } from "@/components/theme/ThemeProvider";

interface HeaderProps {
  title: string;
  subtitle?: string;
  user: AuthUser | null;
  onMenuClick: () => void;
}

export function Header({ title, subtitle, user, onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md transition-colors duration-300">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="p-2 rounded-xl lg:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60 active:scale-95 transition-all duration-200"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-col justify-center">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white transition-colors duration-300 leading-none">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors duration-300 leading-none">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60 active:scale-95 transition-all duration-300 relative group overflow-hidden"
            aria-label="Toggle theme"
          >
            <div className="transition-transform duration-500 group-hover:rotate-12">
              {theme === "dark" ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-600" />}
            </div>
          </button>

          <button
            type="button"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60 active:scale-95 transition-all duration-200 relative group"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
          </button>

          {user && (
            <Link
              href="/dashboard/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-500/10 hover:scale-105 active:scale-95 transition-all duration-300 border border-emerald-500/20 ml-1"
              title="Profile"
            >
              <span>{user.firstName[0]}</span>
              <span>{user.lastName[0]}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}