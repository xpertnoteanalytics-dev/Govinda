"use client";

import { useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";

interface ChatLayoutProps {
  chatId?: string;
}

export function ChatLayout({ chatId: initialChatId }: ChatLayoutProps) {
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div
        className={`
          transition-all duration-300 ease-in-out shrink-0
          ${sidebarOpen ? "w-72" : "w-0 overflow-hidden"}
        `}
      >
        <ChatSidebar
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onNewChat={() => setActiveChatId(null)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <ChatWindow
          chatId={activeChatId}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onChatCreated={setActiveChatId}
        />
      </div>
    </div>
  );
}