"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/dashboard/chat")) {
    return { title: "AI Assistant", subtitle: "Healthcare operations copilot" };
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
        <main
          className={cn(
            "flex flex-1 flex-col min-h-0",
            isChat ? "relative overflow-hidden p-0" : "p-4 sm:p-6"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
