"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Send, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

interface CustomSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type WindowWithSpeech = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => CustomSpeechRecognition;
    webkitSpeechRecognition?: new () => CustomSpeechRecognition;
  };

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, disabled, onSend]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const win = typeof window !== "undefined" ? (window as WindowWithSpeech) : null;
  const speechSupported = !!(win?.SpeechRecognition ?? win?.webkitSpeechRecognition);

  function toggleVoice() {
    if (!win) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) return;

   const rec = new SR() as unknown as CustomSpeechRecognition;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-shadow",
        disabled ? "opacity-60" : "focus-within:ring-2 focus-within:ring-ring"
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed py-1 min-h-[28px] max-h-40"
        aria-label="Message input"
      />

      {speechSupported && (
        <button
          type="button"
          onClick={toggleVoice}
          disabled={disabled}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          className={cn(
            "shrink-0 p-1.5 rounded-lg transition-colors",
            isListening
              ? "text-red-500 bg-red-50 dark:bg-red-950 animate-pulse"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {isListening ? (
            <Square className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
        className={cn(
          "shrink-0 p-1.5 rounded-lg transition-colors",
          canSend
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "text-muted-foreground cursor-not-allowed"
        )}
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}