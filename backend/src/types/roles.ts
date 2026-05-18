export const ROLES = {
  SUPER_ADMIN: "super_admin",
  TENANT_ADMIN: "tenant_admin",
  CLINICIAN: "clinician",
  STAFF: "staff",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.TENANT_ADMIN]: 80,
  [ROLES.CLINICIAN]: 60,
  [ROLES.STAFF]: 40,
  [ROLES.VIEWER]: 20,
};

export const ALL_ROLES = Object.values(ROLES);
