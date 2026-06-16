// src/lib/auth-api.ts  (frontend — Next.js route handlers, not Express)
//
// These functions call the Next.js /api/* route handlers which in turn
// proxy to the Express backend. All types must match AuthUser in auth.ts.

import type { AuthSession, AuthUser } from "./auth";

interface SessionResponse {
  success?: boolean;
  user?: AuthUser;
  authenticated?: boolean;
  error?: { message: string };
}

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ── signup ────────────────────────────────────────────────────────────────────
//
// organizationLogo is optional — a base64 data-URL chosen during signup.
// It is sent to the backend which persists it on the Tenant record.

export async function signup(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  /** Optional base64 data-URL for the organization logo (max 2 MB). */
  organizationLogo?: string;
}): Promise<AuthSession> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await parseJson<SessionResponse & { user: AuthUser }>(res);
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Signup failed");
  }

  return { user: data.user, accessToken: "", refreshToken: "" };
}

// ── login ─────────────────────────────────────────────────────────────────────

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await parseJson<SessionResponse & { user: AuthUser }>(res);
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Login failed");
  }

  return { user: data.user, accessToken: "", refreshToken: "" };
}

// ── logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

// ── fetchCurrentUser ──────────────────────────────────────────────────────────

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await fetch("/api/auth/session");
  const data = await parseJson<SessionResponse>(res);

  if (!res.ok || !data.user) {
    throw new Error("Not authenticated");
  }

  return data.user;
}

// ── refreshSession ────────────────────────────────────────────────────────────

export async function refreshSession(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", { method: "POST" });
  return res.ok;
}