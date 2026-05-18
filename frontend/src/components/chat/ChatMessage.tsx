"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "./MarkdownContent";
import { TypingMessage } from "./TypingMessage";
import type { ChatMessage as ChatMessageType } from "@/lib/chat-api";

interface ChatMessageProps {
  message: ChatMessageType;
  animate?: boolean;
  onAnimationComplete?: () => void;
}

export function ChatMessageBubble({
  message,
  animate = false,
  onAnimationComplete,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-brand-600 text-white"
            : "bg-gradient-to-br from-brand-100 to-cyan-100 text-brand-700"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" aria-hidden />
        ) : (
          <Bot className="h-4 w-4" aria-hidden />
        )}
      </div>

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%]",
          isUser
            ? "bg-brand-600 text-white"
            : "border border-slate-200/80 bg-white shadow-card"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : animate ? (
          <TypingMessage
            content={message.content}
            onComplete={onAnimationComplete}
            speed={8}
          />
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
    </div>
  );
}
