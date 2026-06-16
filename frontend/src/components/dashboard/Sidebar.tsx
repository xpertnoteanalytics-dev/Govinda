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
  Star,
  MessagesSquare,
  User,
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
  { href: "/dashboard/stakeholders", label: "Stakeholders", icon: User },
  { href: "/dashboard/appointments", label: "Appointments", icon: Activity },
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
      {/* Mobile Overlay Backdrop */}
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

      {/* Sidebar Container */}
      <aside
        className={cn(
          // Base setup locks the frame to viewport heights strictly (prevents page body stretching)
          "fixed inset-y-0 left-0 z-50 flex w-72 h-screen flex-col border-r border-slate-200/80 bg-white/95 text-slate-900 shadow-xl transition-transform duration-300 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/95 dark:text-slate-50 overflow-hidden",
          // On desktop layouts, it sits sticky and perfectly balanced without layout shifting
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header Branding Area */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-5 dark:border-slate-800/60">
          <Link href="/dashboard" className="flex items-center gap-3 group cursor-pointer">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3">
              <Activity className="h-4 w-4" aria-hidden />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white transition-colors duration-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {APP_NAME}
              </span>
              <span className="text-[9px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase leading-none mt-0.5">
                Workspace
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl lg:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60 active:scale-95 transition-all duration-200"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic User Summary Profile Block */}
{user && (
  <div className="shrink-0 border-b border-slate-200/80 px-4 py-4 bg-slate-50/40 dark:bg-slate-900/10">
    
    {/* Organization row — logo + org name */}
    <div className="flex items-center gap-2.5 mb-3">
      {user.tenant.logo ? (
        <img
          src={user.tenant.logo}
          alt={user.tenant.name}
          className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/10 shrink-0"
        />
      ) : (
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {user.tenant.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Organization
        </p>
        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
          {user.tenant.name}
        </p>
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-slate-200/60 dark:border-white/10 mb-3" />

    {/* User row — name + role badge */}
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

        {/* Primary Navigation Hub (The only container configured to handle scrolling inside the panel) */}
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
                {/* Active Interactive Layout Pill */}
                {isActive && (
                  <motion.div
                    layoutId="active-menu-pill"
                    className="absolute inset-0 -z-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-400/10 dark:border-emerald-400/15 shadow-sm shadow-emerald-500/5"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}

                {/* Hover Soft Dynamic Backdrop */}
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

        {/* Actions Context Footer */}
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

      {/* Embedded style tag to guarantee smooth minimalist scrolling across navigation breaks */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 99px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </>
  );
}