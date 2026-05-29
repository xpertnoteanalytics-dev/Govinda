export interface ApiError {
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

let refreshInFlight: Promise<boolean> | null = null;

async function parseResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !json.success) {
    const message = json.error?.message ?? "Request failed";
    throw new Error(message);
  }

  return json.data as T;
}

async function refreshSessionOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        return refreshed.ok;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function clearSessionAndRedirectToLogin(): Promise<void> {
  try {
    // Clears HttpOnly cookies server-side even if backend logout fails.
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // ignore
  }

  // If we're in the browser, force navigation to stop UI retry loops.
  if (typeof window !== "undefined") {
    const redirect = `${window.location.pathname}${window.location.search}`;
    const url = new URL("/login", window.location.origin);
    url.searchParams.set("redirect", redirect);
    window.location.assign(url.toString());
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const proxyPath = `/api/proxy${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(proxyPath, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(new Headers(options.headers).entries()),
    },
    credentials: "include",
  });

  if (res.status === 401 && retry) {
    const ok = await refreshSessionOnce();
    if (ok) {
      return apiFetch<T>(path, options, false);
    }

    // Refresh failed (expired/invalid session). Clean up and stop infinite loops.
    await clearSessionAndRedirectToLogin();
  }

  return parseResponse<T>(res);
}
