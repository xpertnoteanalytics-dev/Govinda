"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  MessagesSquare,
  User,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLES } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoleBadge } from "@/components/auth/RoleBadge";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "AI Assistant", icon: Sparkles },
  { href: "/dashboard/search", label: "Find Care", icon: MapPin },
  { href: "/dashboard/avatar", label: "Govinda & Durga", icon: UserCircle2 },
  { href: "/dashboard/calls", label: "Calls", icon: Phone },
  { href: "/dashboard/outreach", label: "Outreach", icon: Send },
  { href: "/dashboard/stakeholders", label: "Stakeholders", icon: User },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarCheck },
  { href: "/dashboard/feedback", label: "Feedbacks", icon: MessagesSquare },
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  const visibleNav = navItems.filter((item) => {
    if (item.minRole && !hasMinRole(item.minRole)) return false;
    return true;
  });

  const checkActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 h-screen flex-col border-r border-slate-200/80 bg-white/95 text-slate-900 shadow-xl transition-transform duration-300 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/95 dark:text-slate-50 overflow-hidden",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* ── PLATFORM STATIC LOGO (never changes per tenant) ─────────────────
            XpertNote Analytics brand logo — fixed asset served from /public.
            Place xpertnotelogo.png in your Next.js /public folder.
            The org logo is separate and lives in the user summary block below.
        ─────────────────────────────────────────────────────────────────────── */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/60">
          <Link href="/dashboard" className="flex items-center group cursor-pointer min-w-0">
            {/* Logo has a black background — rounded + contained so it blends
                on both light and dark sidebars without colour clash */}
            <div className="relative overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-105">
              <img
                src="/xpertnotelogo.png"
                alt="XpertNote Analytics"
                width={148}
                height={48}
                className="h-12 w-auto object-contain"
                draggable={false}
              />
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="ml-2 p-2 rounded-xl lg:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60 active:scale-95 transition-all duration-200 shrink-0"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── ORGANIZATION LOGO (DYNAMIC — changes per logged-in org) ─────────
            Shows the organization's own uploaded logo next to their name.
            Falls back to a coloured initial avatar when no logo is set.
            Sourced from user.tenant.logo which is stored on the Tenant model.
        ─────────────────────────────────────────────────────────────────────── */}
        {user && (
          <div className="shrink-0 border-b border-slate-200/80 px-4 py-4 bg-slate-50/40 dark:bg-slate-900/10">

            {/* Organization row — dynamic org logo + org name */}
            <div className="flex items-center gap-2.5 mb-3">
              {user.tenant.logo ? (
                // ✅ Uploaded org logo
                <img
                  src={user.tenant.logo}
                  alt={user.tenant.name}
                  className="h-8 w-8 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10 shrink-0"
                />
              ) : (
                // ✅ Fallback: first letter of org name in brand gradient
                <div
                  className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shrink-0"
                  aria-label={`${user.tenant.name} logo placeholder`}
                >
                  {user.tenant.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Organization
                </p>
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                  {user.tenant.name}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200/60 dark:border-white/10 mb-3" />

            {/* User row — initials avatar + name + role badge */}
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {user.firstName} {user.lastName}
                </p>
                <div className="mt-1">
                  <RoleBadge role={user.role} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-x-hidden overflow-y-auto custom-scrollbar">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = checkActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold tracking-wide outline-none transition-colors duration-300 select-none",
                  isActive
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-menu-pill"
                    className="absolute inset-0 -z-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-400/10 dark:border-emerald-400/15 shadow-sm shadow-emerald-500/5"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {hoveredItem === item.href && !isActive && (
                  <motion.div
                    layoutId="hover-menu-backdrop"
                    className="absolute inset-0 -z-10 rounded-xl bg-slate-100 dark:bg-slate-900/60"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-300",
                    isActive ? "scale-105" : "group-hover:scale-105"
                  )}
                  aria-hidden
                />
                <span className="relative z-10 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200/80 p-3 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-400 active:scale-[0.98] transition-all duration-300"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </>
  );
}