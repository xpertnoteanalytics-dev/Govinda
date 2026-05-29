import { apiFetch } from "./api";

export type AvatarPersonaId = "govinda" | "durga";

export interface AvatarPersonaMeta {
  id: AvatarPersonaId;
  name: string;
  title: string;
  description: string;
  tone: string;
  elevenLabsVoiceId: string;
  anamAgentEnv: string;
}

export interface AvatarSettings {
  persona: AvatarPersonaId;
  elevenLabsVoiceId: string;
  meta: AvatarPersonaMeta;
}

export interface AvatarSessionResult {
  mode: "anam" | "static";
  sessionId: string | null;
  sessionToken: string | null;
  token: string | null;
  expiresAt?: string;
  streamUrl?: string;
  reason?: string;
  persona: AvatarPersonaId;
  avatar: AvatarPersonaMeta;
}

export async function listPersonas(): Promise<AvatarPersonaMeta[]> {
  const data = await apiFetch<{ personas: AvatarPersonaMeta[] }>(
    "/v1/avatar/personas"
  );
  return data.personas;
}

export async function getAvatarSettings(): Promise<AvatarSettings> {
  const data = await apiFetch<{ settings: AvatarSettings }>(
    "/v1/avatar/settings"
  );
  return data.settings;
}

export async function updateAvatarPersona(
  persona: AvatarPersonaId
): Promise<AvatarSettings> {
  const data = await apiFetch<{ settings: AvatarSettings }>(
    "/v1/avatar/settings",
    {
      method: "PATCH",
      body: JSON.stringify({ persona }),
    }
  );
  return data.settings;
}

export async function getAvatarSession(): Promise<AvatarSessionResult> {
  // backendProxy returns the session object directly (not nested),
  // so the proxy wraps it as { success: true, data: <session> }
  // and apiFetch unwraps to <session> — no extra .data needed.
  const result = await apiFetch<AvatarSessionResult>(
    "/v1/avatar/session",
    { method: "POST" }
  );

  // ── DEBUG: remove after confirming fix ──────────────────────────────────
  console.log("[avatar-api] getAvatarSession raw result:", result);
  console.log("[avatar-api] sessionToken:", result?.sessionToken ?? result?.token);
  console.log("[avatar-api] mode:", result?.mode);
  // ────────────────────────────────────────────────────────────────────────

  // Guard: if the backend ever nests under a key, unwrap it gracefully.
  // This handles both { sessionToken } and { session: { sessionToken } }
  const session = (result as any)?.session ?? result;

  if (!session || typeof session !== "object") {
    throw new Error("[avatar-api] Unexpected session response shape");
  }

  return {
    mode:         session.mode         ?? "static",
    sessionId:    session.sessionId    ?? null,
    sessionToken: session.sessionToken ?? session.token ?? null,
    token:        session.token        ?? session.sessionToken ?? null,
    expiresAt:    session.expiresAt,
    streamUrl:    session.streamUrl,
    reason:       session.reason,
    persona:      session.persona,
    avatar:       session.avatar,
  };
}