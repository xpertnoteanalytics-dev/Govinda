"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  isLoading,
  placeholder = "Ask Govinda AI about workflows, compliance, or operations…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-200 bg-white/90 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled || isLoading}
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled || isLoading}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            value.trim() && !disabled && !isLoading
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-slate-200 text-ink-subtle"
          )}
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-ink-subtle">
        Govinda AI provides operational guidance — not medical diagnosis. Verify critical decisions with licensed professionals.
      </p>
    </form>
  );
}
