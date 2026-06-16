"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getChat, sendMessage, createChat } from "@/lib/chat-api";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatLoading } from "./ChatLoading";

interface IChatMessage {
  _id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatWindowProps {
  chatId: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onChatCreated: (id: string) => void;
}

// Suggestions are generic — org name injected dynamically from auth context
const SUGGESTION_TEMPLATES = [
  "Book an appointment",
  "Submit patient feedback",
  "What services do you offer?",
  "How can you help me today?",
];

export function ChatWindow({
  chatId,
  sidebarOpen,
  onToggleSidebar,
  onChatCreated,
}: ChatWindowProps) {
  const { user } = useAuth();
  const orgName = user?.tenant?.name ?? "";

  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingChat, setIsFetchingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load messages when chat changes
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      activeIdRef.current = null;
      return;
    }

    activeIdRef.current = chatId;
    setIsFetchingChat(true);
    setError(null);

    getChat(chatId)
      .then((chat) => {
        // Only update if this chat is still active (avoid race conditions)
        if (activeIdRef.current === chatId) {
          setMessages(chat.messages ?? []);
        }
      })
      .catch(() => {
        if (activeIdRef.current === chatId) {
          setError("Failed to load conversation. Please try again.");
        }
      })
      .finally(() => {
        if (activeIdRef.current === chatId) {
          setIsFetchingChat(false);
        }
      });
  }, [chatId]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;
      setError(null);

      // If no active chat, create one first
      let currentChatId = chatId;
      if (!currentChatId) {
        try {
          const newChat = await createChat();
          currentChatId = newChat._id;
          onChatCreated(newChat._id);
        } catch {
          setError("Failed to start a new conversation. Please try again.");
          return;
        }
      }

      // Optimistically add user message
      const optimisticUser: IChatMessage = {
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);
      setIsLoading(true);

      try {
        const result = await sendMessage(currentChatId, content);
        // Replace optimistic message + add assistant reply
        setMessages((prev) => {
          const withoutOptimistic = prev.slice(0, -1);
          return [...withoutOptimistic, result.userMessage, result.assistantMessage];
        });
      } catch {
        // Remove the optimistic message on failure
        setMessages((prev) => prev.slice(0, -1));
        setError("Failed to send message. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, isLoading, onChatCreated]
  );

  const isEmpty = !isFetchingChat && messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>
        <div>
          <h1 className="text-sm font-semibold text-foreground">AI Assistant</h1>
          {orgName && (
            <p className="text-xs text-muted-foreground">{orgName}</p>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isFetchingChat ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          /* Welcome / empty state */
          <div className="flex flex-col items-center justify-center h-full px-6 text-center max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
              <span className="text-white text-xl font-bold">G</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Hi! I'm Govinda AI
            </h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              {orgName
                ? `Your AI assistant for ${orgName}. I can help you book appointments, submit feedback, and answer questions.`
                : "Your healthcare AI assistant. I can help you book appointments, submit feedback, and answer questions."}
            </p>

            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {SUGGESTION_TEMPLATES.map((text) => (
                <button
                  key={text}
                  onClick={() => handleSend(text)}
                  className="px-4 py-3 rounded-xl border border-border bg-muted/50 hover:bg-muted text-sm text-left text-foreground transition-colors"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="px-4 py-6 space-y-1 max-w-3xl mx-auto w-full">
            {messages.map((msg, i) => (
              <ChatMessage key={msg._id ?? i} message={msg} />
            ))}
            {isLoading && <ChatLoading />}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Non-empty chat loading indicator */}
        {!isEmpty && isLoading && messages.length === 0 && (
          <div ref={bottomRef} />
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} disabled={isLoading || isFetchingChat} />
        </div>
      </div>
    </div>
  );
}