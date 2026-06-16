// src/lib/auth.ts
//
// Canonical AuthUser type. Shared by client components, server components,
// cookie parsing, and AuthProvider.
//
// TWO LOGOS — never confuse them:
//   1. Govinda AI logo  → static SVG/icon in sidebar header. Never stored here.
//   2. Organization logo → tenant.logo below. Dynamic per org. Null when unset.

import {
  AUTH_COOKIE_ACCESS,
  AUTH_COOKIE_REFRESH,
  AUTH_COOKIE_USER,
  type Role,
} from "./constants";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    /**
     * The organization's OWN uploaded logo (base64 data-URL or CDN URL).
     * Undefined / absent when no logo has been set.
     * Components should guard: `user.tenant.logo ? <img> : <fallback>`
     */
    logo?: string;
  };
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1] ?? "");
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function setAuthCookies(session: AuthSession) {
  setCookie(AUTH_COOKIE_ACCESS, session.accessToken, 60 * 60); // 1 hour
  setCookie(AUTH_COOKIE_REFRESH, session.refreshToken);
  setCookie(AUTH_COOKIE_USER, JSON.stringify(session.user));
}

export function clearAuthCookies() {
  deleteCookie(AUTH_COOKIE_ACCESS);
  deleteCookie(AUTH_COOKIE_REFRESH);
  deleteCookie(AUTH_COOKIE_USER);
}

export function getAccessToken(): string | null {
  return getCookie(AUTH_COOKIE_ACCESS);
}

export function getRefreshToken(): string | null {
  return getCookie(AUTH_COOKIE_REFRESH);
}

export function getStoredUser(): AuthUser | null {
  const raw = getCookie(AUTH_COOKIE_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}