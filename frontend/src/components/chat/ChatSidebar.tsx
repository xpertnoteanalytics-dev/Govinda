"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageSquarePlus,
  Trash2,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSummary } from "@/lib/chat-api";
import { createChat, deleteChat } from "@/lib/chat-api";
import { useState } from "react";

interface ChatSidebarProps {
  chats: ChatSummary[];
  onChatsChange: () => void;
  className?: string;
}

export function ChatSidebar({ chats, onChatsChange, className }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleNewChat() {
    setIsCreating(true);
    try {
      const chat = await createChat();
      onChatsChange();
      router.push(`/dashboard/chat/${chat.id}`);
    } catch {
      // ignore
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, chatId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(chatId);
    try {
      await deleteChat(chatId);
      onChatsChange();
      if (pathname.includes(chatId)) {
        router.push("/dashboard/chat");
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-slate-200 bg-white",
        className
      )}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">AI Assistant</h2>
            <p className="text-xs text-ink-muted">Healthcare copilot</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          disabled={isCreating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          {isCreating ? "Creating…" : "New conversation"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {chats.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessagesSquare className="mx-auto h-8 w-8 text-ink-subtle" />
            <p className="mt-2 text-sm text-ink-muted">No conversations yet</p>
            <p className="mt-1 text-xs text-ink-subtle">
              Start a new chat to get help
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => {
              const href = `/dashboard/chat/${chat.id}`;
              const isActive = pathname === href;

              return (
                <li key={chat.id}>
                  <Link
                    href={href}
                    className={cn(
                      "group flex items-start gap-2 rounded-xl px-3 py-2.5 transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-900"
                        : "text-ink-muted hover:bg-slate-50 hover:text-ink"
                    )}
                  >
                    <MessagesSquare
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        isActive ? "text-brand-600" : "text-ink-subtle"
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{chat.title}</p>
                      {chat.preview && (
                        <p className="truncate text-xs opacity-70">{chat.preview}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, chat.id)}
                      disabled={deletingId === chat.id}
                      className="shrink-0 rounded-lg p-1 opacity-0 transition-opacity hover:bg-red-50 hover:text-clinical-danger group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
