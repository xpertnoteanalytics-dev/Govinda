import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { AvatarSettings, Chat } from "../models";
import { resolveObjectIdString } from "../utils/resolveId";
import { AVATAR_PERSONAS, type AvatarPersonaId } from "../types/avatars";
import type { AvatarPersona } from "../models/AvatarSettings";
import * as aiService from "./aiService";
import type { Role } from "../types/roles";

// ─── Avatar Settings ──────────────────────────────────────────────────────────

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
      ...(updates.elevenLabsVoiceId
        ? { elevenLabsVoiceId: updates.elevenLabsVoiceId }
        : {}),
    },
    { upsert: true, new: true }
  );
  const meta = AVATAR_PERSONAS[settings.persona as AvatarPersonaId];
  return { persona: settings.persona, meta };
}

export function listAvatarPersonas() {
  return Object.values(AVATAR_PERSONAS);
}

// ─── Avatar Provider Helpers ──────────────────────────────────────────────────

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
      throw new AppError(
        503,
        `Missing Anam agent id for ${persona}.`,
        "ANAM_AGENT_NOT_CONFIGURED"
      );
    }
    return id;
  }

  async createSession(persona: AvatarPersonaId): Promise<AvatarSessionResult> {
    if (!env.anam.apiKey) {
      throw new AppError(
        503,
        "Avatar service is not configured. Set ANAM_API_KEY.",
        "ANAM_NOT_CONFIGURED"
      );
    }
    const agentId = this.resolveAgentId(persona);
    const endpoint = "https://api.anam.ai/v1/auth/session-token";
    console.log("[anam] creating session", {
      endpoint,
      persona,
      agentId,
      apiKeyMasked: maskSecret(env.anam.apiKey),
    });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.anam.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personaId: agentId,
        clientLabel: `govinda-ai-${persona}`,
        // Disable Anam's built-in LLM brain so the persona ONLY speaks
        // when we explicitly call client.talk(). Without this, Anam
        // generates its own reply when the user speaks — causing double responses.
        // CUSTOMER_CLIENT_V1 = 'I am bringing my own LLM (Gemini)'
        personaConfig: {
          llmId: 'CUSTOMER_CLIENT_V1',
        },
      }),
    });
    const rawBody = await res.text();
    let data: {
      id?: string;
      session_id?: string;
      token?: string;
      sessionToken?: string;
      stream_url?: string;
      expires_at?: string;
      data?: { sessionToken?: string; token?: string; expiresAt?: string };
      error?: { message?: string };
      message?: string;
    } = {};
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch {
      data = {};
    }
    console.log("[anam] session response", {
      status: res.status,
      ok: res.ok,
      body: rawBody || "(empty)",
    });
    if (!res.ok) {
      throw new AppError(
        502,
        data.error?.message ?? data.message ?? "Failed to create Anam session",
        "ANAM_SESSION_FAILED"
      );
    }
    const sessionToken =
      data.sessionToken ??
      data.token ??
      data.data?.sessionToken ??
      data.data?.token ??
      null;
    if (!sessionToken) {
      throw new AppError(
        502,
        "Anam session token missing in response",
        "ANAM_TOKEN_MISSING"
      );
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

export async function createAvatarSession(
  persona: AvatarPersonaId
): Promise<AvatarSessionResult> {
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

// ─── Avatar ↔ Gemini Bridge ───────────────────────────────────────────────────

const AVATAR_CHAT_TITLE = "Anam Avatar";

/**
 * Returns the single persistent avatar Chat for this user+tenant.
 * Auto-creates it on the first call — no manual setup needed.
 */
export async function getOrCreateAvatarChat(
  tenantId: string,
  userId: string
): Promise<string> {
  const tenantOid = resolveObjectIdString(tenantId, "tenantId");
  const userOid = resolveObjectIdString(userId, "userId");

  const existing = await Chat.findOne({
    tenantId: tenantOid,
    userId: userOid,
    avatarChat: true,
  });

  if (existing) {
    return existing._id.toString();
  }

  const created = await Chat.create({
    tenantId: tenantOid,
    userId: userOid,
    title: AVATAR_CHAT_TITLE,
    avatarChat: true,
    messages: [],
  });

  console.log("[avatar] created persistent avatar chat", created._id.toString());
  return created._id.toString();
}

/**
 * Processes a voice message from Anam Avatar through the SAME Gemini
 * pipeline used by the chat UI.
 *
 * Flow:
 *   Anam Avatar → processAvatarMessage
 *               → aiService.sendMessage          (same as chat UI)
 *               → Gemini
 *               → extractAppointmentAndSave      (same as chat UI)
 *               → extractFeedbackAndSave         (same as chat UI)
 *
 * @param tenantId  - tenant context
 * @param userId    - authenticated user
 * @param userRole  - role for system prompt customisation
 * @param content   - transcribed speech text from Anam
 */
export async function processAvatarMessage(
  tenantId: string,
  userId: string,
  userRole: Role,
  content: string
): Promise<{ reply: string; chatId: string }> {
  // 1. Get (or auto-create) the persistent avatar chat
  const chatId = await getOrCreateAvatarChat(tenantId, userId);

  // 2. Run through the exact same Gemini pipeline as the chat UI.
  //    Appointments, feedback, and all side-effects fire here automatically.
  const result = await aiService.sendMessage(
    chatId,
    tenantId,
    userId,
    userRole,
    content
  );

  return {
    reply: result.assistantMessage.content,
    chatId,
  };
}