"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  X,
  UserCircle,
  Shield,
  Sparkles,
  MapPin,
  Phone,
  UserCircle2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, ROLES } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoleBadge } from "@/components/auth/RoleBadge";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "AI Assistant", icon: Sparkles },
  { href: "/dashboard/search", label: "Find Care", icon: MapPin },
  { href: "/dashboard/avatar", label: "Govinda & Durga", icon: UserCircle2 },
  { href: "/dashboard/calls", label: "Calls", icon: Phone },
  { href: "/dashboard/outreach", label: "Outreach", icon: Send },
  { href: "/dashboard/appointments", label: "Appointments", icon: Activity },
  { href: "/dashboard/feedback", label: "Feedbacks", icon: Activity },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  {
    href: "/dashboard/admin",
    label: "Admin",
    icon: Shield,
    minRole: ROLES.TENANT_ADMIN,
  },
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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-slate-950/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
              <Activity className="h-4 w-4" aria-hidden />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">{APP_NAME}</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="ops-icon-btn lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user && (
          <div className="border-b border-white/10 px-5 py-4">
            <p className="truncate text-sm font-medium text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-slate-400">{user.tenant.name}</p>
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
              (item.href === "/dashboard/chat" && pathname.startsWith("/dashboard/chat")) ||
              (item.href === "/dashboard/search" && pathname.startsWith("/dashboard/search")) ||
              (item.href === "/dashboard/avatar" && pathname.startsWith("/dashboard/avatar")) ||
              (item.href === "/dashboard/calls" && pathname.startsWith("/dashboard/calls")) ||
              (item.href === "/dashboard/outreach" &&
                pathname.startsWith("/dashboard/outreach"));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-brand-500/15 text-brand-200 ring-1 ring-brand-500/25 shadow-sm shadow-brand-500/10"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
