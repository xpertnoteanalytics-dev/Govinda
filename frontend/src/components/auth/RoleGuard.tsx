"use client";

import { useAuth } from "./AuthProvider";
import type { Role } from "@/lib/constants";

export function RoleGuard({
  minRole,
  roles,
  children,
  fallback = null,
}: {
  minRole?: Role;
  roles?: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, hasMinRole, hasRole } = useAuth();

  if (!user) return fallback;

  if (roles && !hasRole(...roles)) return fallback;
  if (minRole && !hasMinRole(minRole)) return fallback;

  return <>{children}</>;
}
