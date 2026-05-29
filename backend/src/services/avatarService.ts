import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { AvatarSettings } from "../models";
import { resolveObjectIdString } from "../utils/resolveId";
import { AVATAR_PERSONAS, type AvatarPersonaId } from "../types/avatars";
import type { AvatarPersona } from "../models/AvatarSettings";

export type AvatarRuntimeMode = "anam" | "static";

export interface AvatarSessionResult {
  mode: AvatarRuntimeMode;
  sessionId: string | null;
  sessionToken: string | null;
  token: string | null;
  expiresAt?: string;
  streamUrl?: string;
  reason?: string;
}

function maskSecret(value: string): string {
  if (!value) return "(empty)";
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function toDebugMessage(err: unknown): string {
  if (err instanceof AppError) return `${err.code ?? "APP_ERROR"}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return "Unknown provider error";
}

export async function getAvatarSettings(tenantId: string, userId: string) {
  let settings = await AvatarSettings.findOne({
    tenantId: resolveObjectIdString(tenantId, "tenantId"),
    userId: resolveObjectIdString(userId, "userId"),
  });
  if (!settings) {
    settings = await AvatarSettings.create({
      tenantId: resolveObjectIdString(tenantId, "tenantId"),
      userId: resolveObjectIdString(userId, "userId"),
      persona: "govinda",
    });
  }
  const meta = AVATAR_PERSONAS[settings.persona as AvatarPersonaId];
  return {
    persona: settings.persona as AvatarPersonaId,
    elevenLabsVoiceId: settings.elevenLabsVoiceId ?? meta.elevenLabsVoiceId,
    meta,
  };
}

export async function updateAvatarSettings(
  tenantId: string,
  userId: string,
  updates: { persona?: AvatarPersona; elevenLabsVoiceId?: string }
) {
  const settings = await AvatarSettings.findOneAndUpdate(
    {
      tenantId: resolveObjectIdString(tenantId, "tenantId"),
      userId: resolveObjectIdString(userId, "userId"),
    },
    {
      ...(updates.persona ? { persona: updates.persona } : {}),
      ...(updates.elevenLabsVoiceId ? { elevenLabsVoiceId: updates.elevenLabsVoiceId } : {}),
    },
    { upsert: true, new: true }
  );
  const meta = AVATAR_PERSONAS[settings.persona as AvatarPersonaId];
  return { persona: settings.persona, meta };
}

export function listAvatarPersonas() {
  return Object.values(AVATAR_PERSONAS);
}

interface AvatarProvider {
  createSession(persona: AvatarPersonaId): Promise<AvatarSessionResult>;
}

class StaticAvatarProvider implements AvatarProvider {
  async createSession(): Promise<AvatarSessionResult> {
    return {
      mode: "static",
      sessionId: null,
      sessionToken: null,
      token: null,
      reason: "Anam avatar unavailable, using static mode.",
    };
  }
}

class AnamAvatarProvider implements AvatarProvider {
  private resolveAgentId(persona: AvatarPersonaId): string {
    const id = env.anam.agentIds[persona];
    if (!id) {
      throw new AppError(503, `Missing Anam agent id for ${persona}.`, "ANAM_AGENT_NOT_CONFIGURED");
    }
    return id;
  }

  async createSession(persona: AvatarPersonaId): Promise<AvatarSessionResult> {
    if (!env.anam.apiKey) {
      throw new AppError(503, "Avatar service is not configured. Set ANAM_API_KEY.", "ANAM_NOT_CONFIGURED");
    }
    const agentId = this.resolveAgentId(persona);
    const endpoint = "https://api.anam.ai/v1/auth/session-token";
    console.log("[anam] creating session", { endpoint, persona, agentId, apiKeyMasked: maskSecret(env.anam.apiKey) });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.anam.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ personaId: agentId, clientLabel: `govinda-ai-${persona}` }),
    });
    const rawBody = await res.text();
    let data: {
      id?: string; session_id?: string; token?: string; sessionToken?: string;
      stream_url?: string; expires_at?: string;
      data?: { sessionToken?: string; token?: string; expiresAt?: string };
      error?: { message?: string }; message?: string;
    } = {};
    try { data = JSON.parse(rawBody) as typeof data; } catch { data = {}; }
    console.log("[anam] session response", { status: res.status, ok: res.ok, body: rawBody || "(empty)" });
    if (!res.ok) {
      throw new AppError(502, data.error?.message ?? data.message ?? "Failed to create Anam session", "ANAM_SESSION_FAILED");
    }
    const sessionToken = data.sessionToken ?? data.token ?? data.data?.sessionToken ?? data.data?.token ?? null;
    if (!sessionToken) {
      throw new AppError(502, "Anam session token missing in response", "ANAM_TOKEN_MISSING");
    }
    return {
      mode: "anam",
      sessionId: data.session_id ?? data.id ?? null,
      sessionToken,
      token: sessionToken,
      expiresAt: data.expires_at ?? data.data?.expiresAt,
      streamUrl: data.stream_url,
    };
  }
}

export async function createAvatarSession(persona: AvatarPersonaId): Promise<AvatarSessionResult> {
  const anam = new AnamAvatarProvider();
  const fallback = new StaticAvatarProvider();
  try {
    return await anam.createSession(persona);
  } catch (err) {
    const debugMessage = toDebugMessage(err);
    console.error("[anam] provider failure", { persona, error: debugMessage });
    const fallbackSession = await fallback.createSession();
    if (!env.isProduction) {
      fallbackSession.reason = `${fallbackSession.reason} Provider error: ${debugMessage}`;
    }
    return fallbackSession;
  }
}
