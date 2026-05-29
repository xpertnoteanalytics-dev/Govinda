export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Govinda AI HealthOps";

export const AUTH_COOKIE_ACCESS = "govinda_access_token";
export const AUTH_COOKIE_REFRESH = "govinda_refresh_token";
export const AUTH_COOKIE_USER = "govinda_user";

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  TENANT_ADMIN: "tenant_admin",
  CLINICIAN: "clinician",
  STAFF: "staff",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
