"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { Send, Loader2, Mic } from "lucide-react";
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
  placeholder = "Ask about care coordination, outreach, or daily operations…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      setValue((v) => (v ? `${v} ` : "") + e.results[0][0].transcript);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }

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
      className="border-t border-white/10 bg-slate-950/90 p-4 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2 shadow-sm transition-all focus-within:border-brand-400/50 focus-within:ring-2 focus-within:ring-brand-500/20">
        <button
          type="button"
          onClick={startVoiceInput}
          disabled={disabled || isLoading || listening}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
          aria-label="Voice input"
        >
          <Mic className={`h-4 w-4 ${listening ? "text-red-500 animate-pulse" : ""}`} />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled || isLoading}
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled || isLoading}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            value.trim() && !disabled && !isLoading
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-white/10 text-slate-500"
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
        Operational guidance only — confirm important decisions with your care team.
      </p>
    </form>
  );
}
