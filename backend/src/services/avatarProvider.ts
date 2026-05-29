import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import type { AvatarPersonaId } from "../types/avatars";

export type AvatarRuntimeMode = "anam" | "static";

export interface AvatarSessionResult {
  mode: AvatarRuntimeMode;
  sessionId: string | null;
  sessionToken: string | null;
  token: string | null;
  expiresAt?: string;
  reason?: string;
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
      reason: "Anam unavailable. Using static avatar.",
    };
  }
}

class AnamAvatarProvider implements AvatarProvider {
  private resolveAgentId(persona: AvatarPersonaId): string {
    const id = env.anam.agentIds[persona];

    if (!id) {
      throw new AppError(
        500,
        `Missing Anam agent id for ${persona}`,
        "ANAM_AGENT_NOT_FOUND"
      );
    }

    return id;
  }

  async createSession(
    persona: AvatarPersonaId
  ): Promise<AvatarSessionResult> {
    if (!env.anam.apiKey) {
      throw new AppError(
        500,
        "ANAM_API_KEY missing",
        "ANAM_API_KEY_MISSING"
      );
    }

    const agentId = this.resolveAgentId(persona);

    // ✅ Correct endpoint
    const endpoint = "https://api.anam.ai/v1/auth/session-token";

    console.log("[anam] creating auth session", {
      persona,
      agentId,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.anam.apiKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        personaConfig: {
          personaId: agentId,
        },

        clientLabel: `govinda-ai-${persona}`,
      }),
    });

    const raw = await response.text();

    console.log("[anam] raw response", raw);

    let data: any = {};

    try {
      data = JSON.parse(raw);
    } catch {
      throw new AppError(
        500,
        "Invalid JSON response from Anam",
        "ANAM_INVALID_JSON"
      );
    }

    if (!response.ok) {
      console.error("[anam] session creation failed", {
        status: response.status,
        body: data,
      });

      throw new AppError(
        response.status,
        data?.error ||
          data?.message ||
          "Failed to create Anam session",
        "ANAM_SESSION_FAILED"
      );
    }

    // ✅ IMPORTANT
    const sessionToken =
      data.sessionToken ||
      data.token ||
      null;

    if (!sessionToken) {
      throw new AppError(
        500,
        "Session token missing in Anam response",
        "ANAM_TOKEN_MISSING"
      );
    }

    return {
      mode: "anam",

      sessionId:
        data.session_id ||
        data.id ||
        null,

      sessionToken,

      token: sessionToken,

      expiresAt:
        data.expires_at ||
        undefined,
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
    console.error("[anam] provider error", err);

    const fallbackSession = await fallback.createSession();

    if (!env.isProduction) {
      fallbackSession.reason =
        err instanceof Error
          ? err.message
          : "Unknown Anam provider error";
    }

    return fallbackSession;
  }
}