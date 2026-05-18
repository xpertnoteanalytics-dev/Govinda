"use client";

import { useEffect, useState } from "react";
import { MarkdownContent } from "./MarkdownContent";

interface TypingMessageProps {
  content: string;
  onComplete?: () => void;
  speed?: number;
}

export function TypingMessage({
  content,
  onComplete,
  speed = 12,
}: TypingMessageProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let index = 0;

    const interval = setInterval(() => {
      index += 1;
      setDisplayed(content.slice(0, index));

      if (index >= content.length) {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, speed]);

  if (done) {
    return <MarkdownContent content={content} />;
  }

  return (
    <div className="text-sm text-ink">
      <span className="whitespace-pre-wrap">{displayed}</span>
      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand-500 align-middle" />
    </div>
  );
}
