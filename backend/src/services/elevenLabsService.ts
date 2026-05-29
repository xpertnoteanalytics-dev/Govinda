import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { AVATAR_PERSONAS, type AvatarPersonaId } from "../types/avatars";

function assertElevenLabsConfigured() {
  if (!env.elevenLabs.apiKey) {
    throw new AppError(
      503,
      "Voice service is not configured. Set ELEVENLABS_API_KEY.",
      "VOICE_NOT_CONFIGURED"
    );
  }
}

export function resolveVoiceId(persona: AvatarPersonaId, override?: string): string {
  return override ?? AVATAR_PERSONAS[persona].elevenLabsVoiceId;
}

export async function textToSpeech(params: {
  text: string;
  voiceId?: string;
  persona?: AvatarPersonaId;
}): Promise<{ audioBase64: string; contentType: string }> {
  assertElevenLabsConfigured();

  const voiceId =
    params.voiceId ??
    (params.persona
      ? AVATAR_PERSONAS[params.persona].elevenLabsVoiceId
      : AVATAR_PERSONAS.govinda.elevenLabsVoiceId);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.elevenLabs.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: params.text.slice(0, 5000),
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new AppError(502, errText || "ElevenLabs TTS failed", "TTS_FAILED");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buffer.toString("base64"), contentType: "audio/mpeg" };
}
