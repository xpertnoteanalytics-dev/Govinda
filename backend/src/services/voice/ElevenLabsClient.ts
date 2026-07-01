// src/services/voice/ElevenLabsClient.ts
//
// Owns ONE persistent WebSocket connection to ElevenLabs' TTS stream-input
// endpoint for the entire call. Connect once, send every flushed phrase
// down the same socket, emit decoded PCM chunks, close once at call end.
// Never reconnects per phrase.

import WebSocket from "ws";
import { env } from "../../config/env";

const ELEVENLABS_WS_BASE = "wss://api.elevenlabs.io/v1/text-to-speech";
const OUTPUT_FORMAT = "pcm_16000";

export interface ElevenLabsClientOptions {
  onAudioChunk: (base64Pcm16k: string) => void;
  onPhraseAudioComplete?: () => void;
  onError?: (err: Error) => void;
}

type ConnectionState = "idle" | "connecting" | "open" | "closed";

export class ElevenLabsClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "idle";
  private readonly voiceId: string;
  private readonly options: ElevenLabsClientOptions;
  private readonly pendingPhrases: string[] = [];

  constructor(options: ElevenLabsClientOptions) {
    this.voiceId = env.elevenLabs.voiceId;
    this.options = options;
  }

  connect(): void {
    if (this.state === "connecting" || this.state === "open") {
      console.warn("[ElevenLabsClient] connect() called while already connecting/open — ignoring");
      return;
    }
    if (!this.voiceId) {
      this.options.onError?.(
        new Error(
          "[ElevenLabsClient] ELEVENLABS_VOICE_ID is not set. Pick an Indian male voice from " +
          "the ElevenLabs Voice Library, add it to My Voices, copy its voice_id, and set it as " +
          "the ELEVENLABS_VOICE_ID environment variable."
        )
      );
      return;
    }

    this.state = "connecting";

    const url =
      `${ELEVENLABS_WS_BASE}/${this.voiceId}/stream-input` +
      `?model_id=${env.elevenLabs.modelId}` +
      `&output_format=${OUTPUT_FORMAT}` +
      `&auto_mode=true` +
      `&inactivity_timeout=180`;

    this.ws = new WebSocket(url);
    const capturedWs = this.ws;

    capturedWs.on("open", () => {
      if (this.state === "closed") {
        capturedWs.close(1000, "closed before open");
        return;
      }
      this.state = "open";
      console.log("[ElevenLabsClient] connected — sending init message");

      this.sendRaw({
        text: " ",
        voice_settings: {
          speed: 1.0,
          stability: 0.45,
          similarity_boost: 0.8,
          // Improves clarity/pronunciation, particularly noticeable on
          // non-English phonemes — recommended by ElevenLabs for
          // conversational agents on Indian-language voices.
          use_speaker_boost: true,
        },
        xi_api_key: env.elevenLabs.apiKey,
      });

      while (this.pendingPhrases.length > 0) {
        const phrase = this.pendingPhrases.shift()!;
        this.sendRaw({ text: phrase });
      }
    });

    capturedWs.on("message", (raw: WebSocket.RawData) => {
      if (this.state === "closed") return;

      let msg: { audio?: string; isFinal?: boolean; error?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        console.warn("[ElevenLabsClient] non-JSON message, ignoring");
        return;
      }

      if (msg.audio) {
        this.options.onAudioChunk(msg.audio);
      }
      if (msg.isFinal) {
        this.options.onPhraseAudioComplete?.();
      }
      if (msg.error) {
        console.error("[ElevenLabsClient] error message from server:", msg.error);
      }
    });

    capturedWs.on("close", (code: number, reason: Buffer) => {
      if (capturedWs === this.ws || this.state !== "closed") {
        console.log(`[ElevenLabsClient] closed — code=${code} reason=${reason.toString() || "(none)"}`);
        this.state = "closed";
        this.ws = null;
      }
    });

    capturedWs.on("error", (err: Error) => {
      console.error("[ElevenLabsClient] connection error:", err.message);
      if (this.state !== "closed") {
        this.options.onError?.(err);
      }
    });
  }

  sendPhrase(phrase: string): void {
    const trimmed = phrase.trim();
    if (!trimmed) return;

    if (this.state === "open") {
      this.sendRaw({ text: trimmed + " " });
    } else if (this.state === "connecting") {
      this.pendingPhrases.push(trimmed + " ");
    } else {
      console.warn(
        `[ElevenLabsClient] sendPhrase() called while state="${this.state}" — phrase dropped: ` +
        `"${trimmed.slice(0, 40)}..."`
      );
    }
  }

  discardPending(): void {
    if (this.pendingPhrases.length > 0) {
      console.log(`[ElevenLabsClient] discarding ${this.pendingPhrases.length} queued phrase(s) on interruption`);
      this.pendingPhrases.length = 0;
    }
  }

  close(): void {
    this.state = "closed";
    this.pendingPhrases.length = 0;

    if (!this.ws) return;
    try {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.sendRaw({ text: "" });
      }
      this.ws.close(1000, "call ended");
    } catch {
      // socket may already be closing — safe to ignore
    }
    this.ws = null;
  }

  isOpen(): boolean {
    return this.state === "open";
  }

  private sendRaw(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }
}
