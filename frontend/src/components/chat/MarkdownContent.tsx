"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none prose-slate",
        "prose-headings:font-semibold prose-headings:text-ink",
        "prose-p:text-ink prose-p:leading-relaxed",
        "prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-ink prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-brand-800 prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-slate-900 prose-pre:text-slate-100",
        "prose-ul:text-ink prose-ol:text-ink",
        "prose-li:marker:text-brand-600",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
