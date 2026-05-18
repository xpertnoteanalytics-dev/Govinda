"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  LogOut,
  X,
  UserCircle,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, ROLES } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoleBadge } from "@/components/auth/RoleBadge";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "AI Assistant", icon: Sparkles },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  {
    href: "/dashboard/admin",
    label: "Admin",
    icon: Shield,
    minRole: ROLES.TENANT_ADMIN,
  },
  { href: "/dashboard/patients", label: "Patients", icon: Users, disabled: true },
  { href: "/dashboard/records", label: "Records", icon: FileText, disabled: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, disabled: true },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hasMinRole } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  const visibleNav = navItems.filter((item) => {
    if (item.minRole && !hasMinRole(item.minRole)) return false;
    return true;
  });

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity className="h-4 w-4" aria-hidden />
            </div>
            <span className="font-semibold text-ink">{APP_NAME}</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user && (
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="truncate text-sm font-medium text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-ink-muted">{user.tenant.name}</p>
            <div className="mt-2">
              <RoleBadge role={user.role} />
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/dashboard/chat" &&
                pathname.startsWith(item.href)) ||
              (item.href === "/dashboard/chat" && pathname.startsWith("/dashboard/chat"));

            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-subtle"
                  title="Coming soon"
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {item.label}
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-800"
                    : "text-ink-muted hover:bg-slate-50 hover:text-ink"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-red-50 hover:text-clinical-danger"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
