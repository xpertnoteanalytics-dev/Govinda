import { ROLES, type Role } from "./constants";

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.TENANT_ADMIN]: 80,
  [ROLES.CLINICIAN]: 60,
  [ROLES.STAFF]: 40,
  [ROLES.VIEWER]: 20,
};

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.TENANT_ADMIN]: "Organization Admin",
  [ROLES.CLINICIAN]: "Clinician",
  [ROLES.STAFF]: "Staff",
  [ROLES.VIEWER]: "Viewer",
};

export function hasMinRole(userRole: Role, minimumRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}

export function hasRole(userRole: Role, ...allowed: Role[]): boolean {
  return allowed.includes(userRole);
}

export function formatRole(role: Role): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}
