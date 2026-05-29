import { cn } from "@/lib/utils";

interface StatusBannerProps {
  variant: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}

const styles = {
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  info: "border-brand-500/25 bg-brand-500/10 text-brand-100",
};

export function StatusBanner({ variant, children, className }: StatusBannerProps) {
  return (
    <p className={cn("rounded-xl border px-3 py-2.5 text-sm", styles[variant], className)}>
      {children}
    </p>
  );
}
