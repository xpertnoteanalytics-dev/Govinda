"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/components/auth/AuthProvider";

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": {
    title: "Operations Dashboard",
    subtitle: "Find Care to feedback, in one workflow",
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

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/dashboard/chat")) {
    return { title: "AI Assistant", subtitle: "Operational guidance and patient communication" };
  }
  if (pathname.startsWith("/dashboard/search")) {
    return { title: "Find Care", subtitle: "Search, call, outreach, and coordinate care" };
  }
  if (pathname.startsWith("/dashboard/avatar")) {
    return { title: "Govinda & Durga", subtitle: "Voice-ready healthcare support assistants" };
  }
  if (pathname.startsWith("/dashboard/calls")) {
    return { title: "Calling Workflow", subtitle: "Click, connect, and coordinate quickly" };
  }
  if (pathname.startsWith("/dashboard/outreach")) {
    return { title: "Outreach & Coordination", subtitle: "WhatsApp, Email, appointments, reports, and feedback" };
  }
  return (
    pageTitles[pathname] ??
    (pathname.startsWith("/dashboard")
      ? { title: "Dashboard" }
      : { title: "Govinda AI" })
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const pageMeta = getPageMeta(pathname);
  const isChat = pathname.startsWith("/dashboard/chat");
  const isFullBleed = isChat || pathname.startsWith("/dashboard/search");

  return (
    <div className="dashboard-shell flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main
          className={cn(
            "flex flex-1 flex-col min-h-0",
            isFullBleed ? "relative overflow-hidden p-0" : "p-4 sm:p-6"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
