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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="ops-icon-btn lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h1>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="ops-icon-btn"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="ops-icon-btn"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          {user && (
            <Link
              href="/dashboard/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-sm"
              title="Profile"
            >
              {user.firstName[0]}
              {user.lastName[0]}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
