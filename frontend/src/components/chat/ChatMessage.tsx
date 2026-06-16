"use client";

import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatMessageProps {
  message: Message;
}

/**
 * Renders a single chat bubble.
 * - User messages: right-aligned, primary colour
 * - Assistant messages: left-aligned, muted background, supports basic markdown
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-1",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-white text-[10px] font-bold">G</span>
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {isUser ? (
          // User text — plain, preserve line breaks
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          // Assistant text — render simple markdown-like formatting
          <AssistantContent content={message.content} />
        )}
      </div>
    </div>
  );
}

/**
 * Renders assistant message content with lightweight formatting:
 * - ✅ / ❌ prefixed lines styled distinctly
 * - **bold** text
 * - Bullet lists (lines starting with •, -, *)
 * - Numbered lines
 * No external markdown lib needed.
 */
function AssistantContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Success / error indicator lines
        if (trimmed.startsWith("✅")) {
          return (
            <p key={i} className="text-green-700 dark:text-green-400 font-medium">
              {renderInline(trimmed)}
            </p>
          );
        }
        if (trimmed.startsWith("❌")) {
          return (
            <p key={i} className="text-destructive font-medium">
              {renderInline(trimmed)}
            </p>
          );
        }

        // Bullet points
        if (/^[•\-\*]\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-0.5 text-muted-foreground shrink-0">•</span>
              <span>{renderInline(trimmed.replace(/^[•\-\*]\s/, ""))}</span>
            </div>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const [num, ...rest] = trimmed.split(/\.\s(.+)/);
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground shrink-0 font-medium">{num}.</span>
              <span>{renderInline(rest.join(""))}</span>
            </div>
          );
        }

        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

/** Renders **bold** inline markers */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}