import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-subtle",
            "border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
            error && "border-clinical-danger focus:border-clinical-danger focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-clinical-danger">{error}</p>}
        {hint && !error && <p className="text-sm text-ink-subtle">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
