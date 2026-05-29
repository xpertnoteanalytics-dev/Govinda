"use client";

import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  value: "english" | "hindi";
  onChange: (value: "english" | "hindi") => void;
  accent?: "brand" | "sky" | "emerald";
}

const accentActive = {
  brand: "bg-brand-500/30 text-white",
  sky: "bg-sky-500/30 text-white",
  emerald: "bg-emerald-500/30 text-white",
};

export function LanguageToggle({
  value,
  onChange,
  accent = "brand",
}: LanguageToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
      {(["english", "hindi"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
            value === lang ? accentActive[accent] : "text-slate-400 hover:text-white"
          )}
        >
          {lang === "english" ? "English" : "Hindi"}
        </button>
      ))}
    </div>
  );
}
