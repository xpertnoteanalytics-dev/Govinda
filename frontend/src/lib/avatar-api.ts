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

export interface AvatarMessageResult {
  reply: string;   // text for Anam to speak
  chatId: string;  // persistent avatar chat id
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
  const result = await apiFetch<AvatarSessionResult>(
    "/v1/avatar/session",
    { method: "POST" }
  );

  console.log("[avatar-api] getAvatarSession raw result:", result);
  console.log("[avatar-api] sessionToken:", result?.sessionToken ?? result?.token);
  console.log("[avatar-api] mode:", result?.mode);

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

/**
 * Sends a message (typed or voice transcript) through the persistent
 * avatar chat pipeline: POST /v1/avatar/message
 *
 * This hits the same Gemini pipeline as the chat UI, so appointments,
 * feedback, and all actions fire identically. The chat is persisted in
 * MongoDB across page reloads — no more lost context.
 */
export async function sendAvatarMessage(
  content: string
): Promise<AvatarMessageResult> {
  const data = await apiFetch<AvatarMessageResult>("/v1/avatar/message", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return data;
}