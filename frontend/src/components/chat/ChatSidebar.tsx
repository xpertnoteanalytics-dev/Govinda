"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { listChats, deleteChat, createChat, type ChatMeta } from "@/lib/chat-api";

interface ChatSidebarProps {
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}

export function ChatSidebar({ activeChatId, onSelectChat, onNewChat }: ChatSidebarProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const orgName = user?.tenant?.name ?? "";
  const orgLogo = user?.tenant?.logo ?? null;

  const fetchChats = useCallback(async () => {
    try {
      const data = await listChats();
      setChats(data);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  async function handleNewChat() {
    try {
      const chat = await createChat();
      setChats((prev) => [chat, ...prev]);
      onSelectChat(chat._id);
    } catch {
      // error handled in ChatWindow
    }
  }

  async function handleDelete(e: React.MouseEvent, chatId: string) {
    e.stopPropagation();
    try {
      await deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      if (activeChatId === chatId) onNewChat();
    } catch {
      // non-critical
    }
  }

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Govinda AI</p>
            <p className="text-xs text-muted-foreground">Healthcare assistant</p>
          </div>
        </div>

        {orgName && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
            {orgLogo ? (
              <img
                src={orgLogo}
                alt={orgName}
                className="w-5 h-5 rounded object-contain shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-primary text-[10px] font-bold">
                  {orgName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate">{orgName}</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4 shrink-0" />
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="space-y-2 px-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((chat) => (
              <li key={chat._id}>
                <button
                  onClick={() => onSelectChat(chat._id)}
                  className={`
                    group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left
                    text-sm transition-colors
                    ${
                      activeChatId === chat._id
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-muted"
                    }
                  `}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{chat.title || "Untitled"}</span>
                  <button
                    onClick={(e) => handleDelete(e, chat._id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}