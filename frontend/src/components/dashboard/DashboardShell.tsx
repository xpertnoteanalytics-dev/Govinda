"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/components/auth/AuthProvider";

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Organization overview",
  },
  "/dashboard/profile": {
    title: "Profile",
    subtitle: "Account settings",
  },
  "/dashboard/admin": {
    title: "Administration",
    subtitle: "Organization controls",
  },
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const pageMeta =
    pageTitles[pathname] ??
    (pathname.startsWith("/dashboard")
      ? { title: "Dashboard" }
      : { title: "Govinda AI" });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
