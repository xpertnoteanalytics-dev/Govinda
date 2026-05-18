"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import type { AuthUser } from "@/lib/auth";

interface HeaderProps {
  title: string;
  subtitle?: string;
  user: AuthUser | null;
  onMenuClick: () => void;
}

export function Header({ title, subtitle, user, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-ink-muted hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-ink sm:text-xl">{title}</h1>
            {subtitle && (
              <p className="text-sm text-ink-muted">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
            <Search className="h-4 w-4 text-ink-subtle" aria-hidden />
            <input
              type="search"
              placeholder="Search…"
              className="w-48 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
              disabled
            />
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-ink-muted hover:bg-slate-100"
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
