"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { listChats, type ChatSummary } from "@/lib/chat-api";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";
import { cn } from "@/lib/utils";

interface ChatLayoutProps {
  chatId?: string;
}

export function ChatLayout({ chatId }: ChatLayoutProps) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);

  const loadChats = useCallback(async () => {
    try {
      const data = await listChats();
      setChats(data);
    } catch {
      setChats([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm lg:hidden"
        aria-label="Open conversations"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Chat list sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-72 transform transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
        <div className="relative z-30 h-full">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute right-2 top-2 z-10 rounded-lg p-1.5 hover:bg-slate-100 lg:hidden"
            aria-label="Close conversations"
          >
            <X className="h-4 w-4" />
          </button>
          {isLoadingList ? (
            <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white p-4">
              <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            </aside>
          ) : (
            <ChatSidebar
              chats={chats}
              onChatsChange={loadChats}
              className="w-72"
            />
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatWindow chatId={chatId} onChatsChange={loadChats} />
      </div>
    </div>
  );
}
