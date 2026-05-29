"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Stethoscope, Shield, FileText } from "lucide-react";
import {
  getChat,
  sendChatMessage,
  createChat,
  type Chat,
  type ChatMessage,
} from "@/lib/chat-api";
import { ChatMessageBubble } from "./ChatMessage";
import { ChatLoading } from "./ChatLoading";
import { ChatInput } from "./ChatInput";
import { useAuth } from "@/components/auth/AuthProvider";

interface ChatWindowProps {
  chatId?: string;
  onChatsChange: () => void;
}

const SUGGESTIONS = [
  "Help me coordinate a patient appointment with a nearby clinic",
  "Draft a simple Hindi follow-up message for lab report sharing",
  "What should I ask a pharmacy about medicine availability?",
];

export function ChatWindow({ chatId, onChatsChange }: ChatWindowProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(Boolean(chatId));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [animateLastReply, setAnimateLastReply] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      setMessages([]);
      setIsLoadingChat(false);
      return;
    }

    setIsLoadingChat(true);
    setError("");

    getChat(chatId)
      .then((loaded) => {
        setChat(loaded);
        setMessages(loaded.messages);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      })
      .finally(() => setIsLoadingChat(false));
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, scrollToBottom]);

  async function handleSend(content: string) {
    setError("");
    setIsSending(true);

    const optimisticUser: ChatMessage = {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);

    try {
      let activeChatId = chatId;

      if (!activeChatId) {
        const newChat = await createChat();
        activeChatId = newChat.id;
        setChat(newChat);
        onChatsChange();
        router.replace(`/dashboard/chat/${newChat.id}`);
      }

      const result = await sendChatMessage(activeChatId, content);

      setChat(result.chat);
      setMessages(result.chat.messages);
      onChatsChange();

      setAnimateLastReply(true);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m !== optimisticUser));
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleSuggestion(text: string) {
    handleSend(text);
  }

  if (isLoadingChat) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-600"
          />
          <p className="text-sm text-ink-muted">Loading conversation…</p>
        </div>
      </div>
    );
  }

  const showEmpty = !chatId && messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-clinical-danger">
              {error}
            </div>
          )}

          {showEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-12 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
                <Sparkles className="h-8 w-8" aria-hidden />
              </div>
              <h2 className="mt-6 text-xl font-bold tracking-tight text-white">
                Hi{user ? `, ${user.firstName}` : ""} — healthcare operations assistant
              </h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Coordinate care, outreach, and patient communication for{" "}
                {user?.tenant.name ?? "your organization"}.
              </p>

              <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-3">
                {[
                  { icon: Stethoscope, label: "Care coordination" },
                  { icon: Shield, label: "Patient communication" },
                  { icon: FileText, label: "Report guidance" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <Icon className="h-5 w-5 text-brand-400" aria-hidden />
                    <span className="text-xs font-medium text-slate-400">{label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 w-full max-w-lg space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Try asking
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    disabled={isSending}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300 transition-all hover:border-brand-400/30 hover:bg-brand-500/10 hover:text-white disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isLastAssistant =
                  msg.role === "assistant" && index === messages.length - 1;
                const shouldAnimate =
                  isLastAssistant && animateLastReply && !isSending;

                return (
                  <ChatMessageBubble
                    key={msg.id ?? `${msg.role}-${index}-${msg.createdAt}`}
                    message={msg}
                    animate={shouldAnimate}
                    onAnimationComplete={() => setAnimateLastReply(false)}
                  />
                );
              })}
              {isSending && <ChatLoading />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput onSend={handleSend} isLoading={isSending} disabled={isLoadingChat} />
    </div>
  );
}
