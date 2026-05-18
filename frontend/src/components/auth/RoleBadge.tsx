import { cn } from "@/lib/utils";
import { formatRole } from "@/lib/roles";
import type { Role } from "@/lib/constants";

const roleStyles: Record<Role, string> = {
  super_admin: "bg-purple-50 text-purple-800 ring-purple-200",
  tenant_admin: "bg-brand-50 text-brand-800 ring-brand-200",
  clinician: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  staff: "bg-slate-100 text-slate-700 ring-slate-200",
  viewer: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        roleStyles[role],
        className
      )}
    >
      {formatRole(role)}
    </span>
  );
}
