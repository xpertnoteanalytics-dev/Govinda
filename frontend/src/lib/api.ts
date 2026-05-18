export interface ApiError {
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !json.success) {
    const message = json.error?.message ?? "Request failed";
    throw new Error(message);
  }

  return json.data as T;
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
    const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
    if (refreshed.ok) {
      return apiFetch<T>(path, options, false);
    }
  }

  return parseResponse<T>(res);
}
