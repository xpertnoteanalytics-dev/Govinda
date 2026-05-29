import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const variant =
    normalized === "completed" ||
    normalized === "sent" ||
    normalized === "delivered"
      ? "ops-status-success"
      : normalized === "failed"
        ? "ops-status-failed"
        : "ops-status-pending";

  return (
    <span className={cn("ops-status-badge", variant, className)}>{status}</span>
  );
}
