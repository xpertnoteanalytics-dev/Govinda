import { API_URL } from "@/lib/constants";
import type { AuthUser } from "@/lib/auth";

interface AuthPayload {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

export class BackendApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function backendFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new BackendApiError(
      res.status,
      json.error?.message ?? "Request failed"
    );
  }

  return json.data as T;
}

export async function backendLogin(credentials: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  return backendFetch<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function backendSignup(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}): Promise<AuthPayload> {
  return backendFetch<AuthPayload>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function backendRefresh(refreshToken: string) {
  return backendFetch<{ tokens: { accessToken: string; refreshToken: string } }>(
    "/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }
  );
}

export async function backendLogout(accessToken: string) {
  return fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export async function backendGetMe(accessToken: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as ApiResponse<{ user: AuthUser }>;
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to fetch user");
  }
  return json.data as { user: AuthUser };
}

export async function backendProxy<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }

  return json.data as T;
}
