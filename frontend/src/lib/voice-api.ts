import { apiFetch } from "./api";

export async function synthesizeSpeech(text: string): Promise<{
  audioBase64: string;
  contentType: string;
}> {
  return apiFetch("/v1/voice/synthesize", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function playBase64Audio(audioBase64: string, contentType = "audio/mpeg") {
  const audio = new Audio(`data:${contentType};base64,${audioBase64}`);
  return audio.play();
}
